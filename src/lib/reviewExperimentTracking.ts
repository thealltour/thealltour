/**
 * PR26/PR27: 리뷰 실험·전환 이벤트 트래킹.
 * 클라이언트에서 POST /api/analytics/review-experiment 호출로 저장.
 */
import type {
  ReviewExperimentKey,
  ReviewExperimentVariant,
  ReviewExperimentExposureEvent,
} from "@/types/reviewExperiment";
import { getAttributionIdentity } from "@/lib/reviewSessionIdentity";

const API_PATH = "/api/analytics/review-experiment";

async function sendEvent(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const identity = typeof window !== "undefined" ? getAttributionIdentity() : { sessionKey: null, userKey: null };
    const payload = {
      ...body,
      ...(identity.sessionKey && { sessionKey: identity.sessionKey }),
    };
    const res = await fetch(API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error ?? "Request failed" };
    return (data as { ok?: boolean }).ok === true ? { ok: true } : { ok: false, error: "Unknown response" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function trackReviewExperimentExposure(
  event: Omit<ReviewExperimentExposureEvent, "createdAt">,
): Promise<{ ok: boolean; error?: string }> {
  const body = {
    experimentKey: event.experimentKey,
    variant: event.variant,
    productId: event.productId,
    eventType: event.eventType,
    reviewId: event.reviewId ?? null,
  };
  return sendEvent(body);
}

export function trackReviewExperimentImpression(
  experimentKey: ReviewExperimentKey,
  variant: ReviewExperimentVariant,
  productId: string,
): Promise<{ ok: boolean; error?: string }> {
  return trackReviewExperimentExposure({
    experimentKey,
    variant,
    productId,
    eventType: "impression",
  });
}

export function trackReviewExperimentClick(
  experimentKey: ReviewExperimentKey,
  variant: ReviewExperimentVariant,
  productId: string,
  reviewId?: string,
): Promise<{ ok: boolean; error?: string }> {
  return trackReviewExperimentExposure({
    experimentKey,
    variant,
    productId,
    reviewId,
    eventType: "click_review",
  });
}

export function trackReviewExperimentExpand(
  experimentKey: ReviewExperimentKey,
  variant: ReviewExperimentVariant,
  productId: string,
  reviewId?: string,
): Promise<{ ok: boolean; error?: string }> {
  return trackReviewExperimentExposure({
    experimentKey,
    variant,
    productId,
    reviewId,
    eventType: "expand_review",
  });
}

export function trackReviewExperimentHelpful(
  experimentKey: ReviewExperimentKey,
  variant: ReviewExperimentVariant,
  productId: string,
  reviewId: string,
): Promise<{ ok: boolean; error?: string }> {
  return trackReviewExperimentExposure({
    experimentKey,
    variant,
    productId,
    reviewId,
    eventType: "click_helpful",
  });
}

export function trackReviewExperimentViewSummary(
  experimentKey: ReviewExperimentKey,
  variant: ReviewExperimentVariant,
  productId: string,
): Promise<{ ok: boolean; error?: string }> {
  return trackReviewExperimentExposure({
    experimentKey,
    variant,
    productId,
    eventType: "view_summary",
  });
}

export function trackReviewExperimentConversion(
  experimentKey: ReviewExperimentKey,
  variant: ReviewExperimentVariant,
  productId: string,
): Promise<{ ok: boolean; error?: string }> {
  return trackReviewExperimentExposure({
    experimentKey,
    variant,
    productId,
    eventType: "conversion",
  });
}

/** PR27: 상품 CTA 클릭 (상담 문의하기 버튼 등) */
export function trackReviewConversionCtaClick(
  productId: string,
  options?: { experimentKey?: string; variant?: string },
): Promise<{ ok: boolean; error?: string }> {
  return sendEvent({
    productId,
    eventType: "product_cta_click",
    experimentKey: options?.experimentKey ?? "review_highlight_variant",
    variant: options?.variant ?? "control",
  });
}

/** PR27: 문의 제출 (상담 폼 제출 완료) */
export function trackReviewConversionInquiry(
  productId: string,
  options?: { experimentKey?: string; variant?: string },
): Promise<{ ok: boolean; error?: string }> {
  return sendEvent({
    productId,
    eventType: "product_inquiry",
    experimentKey: options?.experimentKey ?? "review_highlight_variant",
    variant: options?.variant ?? "control",
  });
}

/** PR27: 예약 시작 (향후 예약 플로우 연동용) */
export function trackReviewConversionBookingStart(
  productId: string,
  options?: { experimentKey?: string; variant?: string },
): Promise<{ ok: boolean; error?: string }> {
  return sendEvent({
    productId,
    eventType: "product_booking_start",
    experimentKey: options?.experimentKey ?? "review_highlight_variant",
    variant: options?.variant ?? "control",
  });
}

/** PR27: 최종 전환 (예약 완료 등, 향후 연동) */
export function trackReviewConversion(
  productId: string,
  options?: { experimentKey?: string; variant?: string },
): Promise<{ ok: boolean; error?: string }> {
  return sendEvent({
    productId,
    eventType: "product_conversion",
    experimentKey: options?.experimentKey ?? "review_highlight_variant",
    variant: options?.variant ?? "control",
  });
}

/** PR27: 개인화 추천 리뷰 블록 노출 (variant=personalized_highlights일 때) */
export function trackPersonalizedReviewView(
  productId: string,
  options?: { experimentKey?: string; variant?: string },
): Promise<{ ok: boolean; error?: string }> {
  return sendEvent({
    productId,
    eventType: "personalized_review_view",
    experimentKey: options?.experimentKey ?? "review_highlight_variant",
    variant: options?.variant ?? "personalized_highlights",
  });
}
