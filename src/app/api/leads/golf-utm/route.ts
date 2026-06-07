/**
 * 골프투어 패키지 리드 UTM 추적 API.
 * POST only. service role로 golf_tour_leads에 적재.
 * 외부 랜딩에서도 호출 가능(CORS). 저장 실패 시 200 + { ok: false } 및 Slack 안전망.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { persistGolfUtmLead } from "@/lib/leads/persistGolfUtmLead";
import type { GolfUtmLeadInput } from "@/lib/leads/golfLeadPayload";

type Body = {
  customerName?: unknown;
  phoneNumber?: unknown;
  groupSize?: unknown;
  targetDestination?: unknown;
  landingPage?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  utmTerm?: unknown;
  utmContent?: unknown;
};

function trimString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseGroupSize(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonWithCors(body: unknown, init?: { status?: number }): NextResponse {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: corsHeaders(),
  });
}

function parseBody(body: Body): GolfUtmLeadInput | null {
  const customerName = trimString(body.customerName);
  const phoneNumber = trimString(body.phoneNumber);
  if (!customerName || !phoneNumber) return null;

  const groupSize = parseGroupSize(body.groupSize);
  return {
    customerName,
    phoneNumber,
    groupSize: groupSize ?? null,
    targetDestination: trimString(body.targetDestination) ?? null,
    landingPage: trimString(body.landingPage) ?? null,
    utmSource: trimString(body.utmSource) ?? null,
    utmMedium: trimString(body.utmMedium) ?? null,
    utmCampaign: trimString(body.utmCampaign) ?? null,
    utmTerm: trimString(body.utmTerm) ?? null,
    utmContent: trimString(body.utmContent) ?? null,
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonWithCors({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const input = parseBody(body);
  if (!input) {
    return jsonWithCors(
      { ok: false, error: "Missing required fields: customerName, phoneNumber" },
      { status: 400 },
    );
  }

  const result = await persistGolfUtmLead(input);
  if (!result.ok) {
    console.error("[golf-utm] insert failed", result.error);
    return jsonWithCors({ ok: false, error: result.error });
  }

  return jsonWithCors({ ok: true, referenceId: result.referenceId });
}
