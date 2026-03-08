/**
 * PR26/PR27: 리뷰 실험 이벤트 수집 API.
 * POST. review_experiment_events 테이블에 적재.
 * PR27: sessionKey 수신 및 전환 이벤트(product_cta_click 등) 지원.
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { REVIEW_EXPERIMENT_EVENT_TYPES } from "@/lib/reviewExperimentConstants";
import type { ReviewExperimentKey, ReviewExperimentVariant } from "@/types/reviewExperiment";

const VALID_KEYS: ReviewExperimentKey[] = [
  "review_highlight_variant",
  "review_summary_variant",
  "review_sort_variant",
];
const VALID_VARIANTS: ReviewExperimentVariant[] = [
  "control",
  "personalized_highlights",
  "summary_first",
  "trust_first",
  "helpful_first",
];

/** PR27: 전환 이벤트는 experimentKey/variant 없이도 수신 가능 */
const CONVERSION_EVENT_TYPES = [
  "product_cta_click",
  "product_inquiry",
  "product_booking_start",
  "product_conversion",
] as const;
/** PR27: 리뷰 상호작용 추가 타입 (기존 실험 이벤트 + personalized_review_view) */
const EXTRA_INTERACTION_TYPES = ["personalized_review_view"] as const;
const ALL_EVENT_TYPES = [
  ...REVIEW_EXPERIMENT_EVENT_TYPES,
  ...CONVERSION_EVENT_TYPES,
  ...EXTRA_INTERACTION_TYPES,
] as const;

type Body = {
  experimentKey?: unknown;
  variant?: unknown;
  productId?: unknown;
  eventType?: unknown;
  reviewId?: unknown;
  sessionKey?: unknown;
};

export async function POST(request: NextRequest) {
  if (request.method !== "POST") {
    return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const eventType = typeof body.eventType === "string" ? body.eventType.trim() : "";
  const reviewId = typeof body.reviewId === "string" ? body.reviewId.trim() || null : null;
  const sessionKey = typeof body.sessionKey === "string" ? body.sessionKey.trim() || null : null;

  const isConversionEvent = (CONVERSION_EVENT_TYPES as readonly string[]).includes(eventType);
  let experimentKey = typeof body.experimentKey === "string" ? body.experimentKey.trim() : (isConversionEvent ? "review_highlight_variant" : "");
  let variant = typeof body.variant === "string" ? body.variant.trim() : (isConversionEvent ? "control" : "");

  if (!productId) {
    return NextResponse.json({ ok: false, error: "productId required" }, { status: 400 });
  }
  if (!(ALL_EVENT_TYPES as readonly string[]).includes(eventType)) {
    return NextResponse.json({ ok: false, error: "Invalid eventType" }, { status: 400 });
  }
  if (eventType === "personalized_review_view" && !experimentKey) {
    experimentKey = "review_highlight_variant";
    variant = variant || "control";
  }
  if (!isConversionEvent) {
    if (!VALID_KEYS.includes(experimentKey as ReviewExperimentKey)) {
      return NextResponse.json({ ok: false, error: "Invalid experimentKey" }, { status: 400 });
    }
    if (!VALID_VARIANTS.includes(variant as ReviewExperimentVariant)) {
      return NextResponse.json({ ok: false, error: "Invalid variant" }, { status: 400 });
    }
  }

  const row = {
    experiment_key: experimentKey || "review_highlight_variant",
    variant: variant || "control",
    product_id: productId,
    event_type: eventType,
    review_id: reviewId,
    occurred_at: new Date().toISOString(),
    ...(sessionKey && { session_key: sessionKey }),
  };

  const { error } = await supabaseAdmin.from("review_experiment_events").insert(row);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}
