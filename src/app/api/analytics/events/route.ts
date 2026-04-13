/**
 * Analytics 이벤트 수집 API.
 * POST only. payload 검증 후 service role로 analytics_events에 적재.
 * 저장 실패 시에도 200 + { ok: false } 반환하여 fire-and-forget 클라이언트 UX가 깨지지 않도록 한다.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createAnalyticsPayload } from "@/lib/analytics/payload";
import { toRow } from "@/lib/analytics/saveAnalyticsEvent";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import type { AnalyticsEventName, AnalyticsSource } from "@/lib/analytics/types";

const VALID_EVENT_NAMES = new Set<string>(Object.keys(ANALYTICS_EVENTS));
const VALID_SOURCES = new Set<string>(Object.keys(ANALYTICS_SOURCES));

type Body = {
  eventName?: unknown;
  source?: unknown;
  pagePath?: unknown;
  deviceType?: unknown;
  taxonomyType?: unknown;
  taxonomyId?: unknown;
  taxonomySlug?: unknown;
  taxonomyName?: unknown;
  section?: unknown;
  label?: unknown;
  href?: unknown;
  position?: unknown;
  query?: unknown;
  resultCount?: unknown;
  productId?: unknown;
  sourcePath?: unknown;
  landingSlug?: unknown;
  templateType?: unknown;
  quoteCategory?: unknown;
  occurredAt?: unknown;
  metadata?: unknown;
};

function isValidEventName(v: unknown): v is AnalyticsEventName {
  return typeof v === "string" && VALID_EVENT_NAMES.has(v);
}

function isValidSource(v: unknown): v is AnalyticsSource {
  return typeof v === "string" && VALID_SOURCES.has(v);
}

export async function POST(request: NextRequest) {
  if (request.method !== "POST") {
    return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!isValidEventName(body.eventName)) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid eventName" },
      { status: 400 },
    );
  }

  if (!isValidSource(body.source)) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid source" },
      { status: 400 },
    );
  }

  const taxonomyTypeRaw = body.taxonomyType;
  const taxonomyType =
    taxonomyTypeRaw === "category" ||
    taxonomyTypeRaw === "theme" ||
    taxonomyTypeRaw === "destination" ||
    taxonomyTypeRaw === "product_line"
      ? taxonomyTypeRaw
      : undefined;

  const payload = createAnalyticsPayload({
    eventName: body.eventName,
    source: body.source,
    pagePath: typeof body.pagePath === "string" ? body.pagePath : undefined,
    deviceType:
      body.deviceType === "desktop" || body.deviceType === "mobile" || body.deviceType === "unknown"
        ? body.deviceType
        : undefined,
    taxonomyType,
    taxonomyId: typeof body.taxonomyId === "string" ? body.taxonomyId : undefined,
    taxonomySlug: typeof body.taxonomySlug === "string" ? body.taxonomySlug : undefined,
    taxonomyName: typeof body.taxonomyName === "string" ? body.taxonomyName : undefined,
    section: typeof body.section === "string" ? body.section : undefined,
    label: typeof body.label === "string" ? body.label : undefined,
    href: typeof body.href === "string" ? body.href : undefined,
    position: typeof body.position === "number" ? body.position : undefined,
    query: typeof body.query === "string" ? body.query : undefined,
    resultCount: typeof body.resultCount === "number" ? body.resultCount : undefined,
    productId: typeof body.productId === "string" ? body.productId : undefined,
    sourcePath: typeof body.sourcePath === "string" ? body.sourcePath : undefined,
    landingSlug: typeof body.landingSlug === "string" ? body.landingSlug : undefined,
    templateType: typeof body.templateType === "string" ? body.templateType : undefined,
    quoteCategory: typeof body.quoteCategory === "string" ? body.quoteCategory : undefined,
    occurredAt: typeof body.occurredAt === "string" ? body.occurredAt : undefined,
    metadata:
      body.metadata != null && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? (body.metadata as Record<string, unknown>)
        : undefined,
  });

  const row = toRow(payload);
  const { error } = await supabaseAdmin.from("analytics_events").insert(row);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
