/**
 * PR27: 리뷰 전환 분석 집계 진입점.
 */
import type {
  ReviewInteractionEvent,
  ReviewConversionSummary,
  ReviewVariantConversionSummary,
  ReviewProductConversionSummary,
  ReviewConversionAttribution,
} from "@/types/reviewConversionAnalytics";
import { getEventsWithAttributionKey } from "./reviewConversionSelectors";
import {
  buildReviewSessionJourneys,
  attributeConversionsFromJourney,
  aggregateReviewConversionAttributions,
} from "./reviewConversionAttribution";

export interface ReviewConversionAnalyticsData {
  reviewSummaries: ReviewConversionSummary[];
  variantSummaries: ReviewVariantConversionSummary[];
  productSummaries: ReviewProductConversionSummary[];
  totalConversions: number;
  totalAttributedConversions: number;
}

/**
 * 원시 이벤트 로드 + attribution 계산 + summary 반환까지 한 번에 수행.
 */
export function getReviewConversionAnalyticsData(
  events: ReviewInteractionEvent[],
  attributionModel: "last_review_touch" | "weighted_review_touch" = "last_review_touch",
): ReviewConversionAnalyticsData {
  const withKey = getEventsWithAttributionKey(events);
  const journeys = buildReviewSessionJourneys(withKey);
  const attributions: ReviewConversionAttribution[] = [];
  for (const j of journeys) {
    attributions.push(...attributeConversionsFromJourney(j, attributionModel));
  }
  const { reviewSummaries, variantSummaries } = aggregateReviewConversionAttributions(
    attributions,
    events,
  );
  const productSummaries = summarizeReviewConversionByProduct(attributions, events);
  const totalConversions = events.filter((e) =>
    ["product_cta_click", "product_inquiry", "product_booking_start", "product_conversion"].includes(
      e.eventType,
    ),
  ).length;
  const totalAttributedConversions = attributions.reduce((s, a) => s + a.attributionScore, 0);
  return {
    reviewSummaries,
    variantSummaries,
    productSummaries,
    totalConversions,
    totalAttributedConversions,
  };
}

/**
 * reviewId 단위 성과 요약.
 */
export function summarizeReviewConversionByReview(
  attributions: ReviewConversionAttribution[],
  events: ReviewInteractionEvent[],
): ReviewConversionSummary[] {
  const { reviewSummaries } = aggregateReviewConversionAttributions(attributions, events);
  return reviewSummaries;
}

/**
 * variant 단위 성과 요약.
 */
export function summarizeReviewConversionByVariant(
  attributions: ReviewConversionAttribution[],
  events: ReviewInteractionEvent[],
): ReviewVariantConversionSummary[] {
  const { variantSummaries } = aggregateReviewConversionAttributions(attributions, events);
  return variantSummaries;
}

/**
 * productId 단위 요약.
 */
export function summarizeReviewConversionByProduct(
  attributions: ReviewConversionAttribution[],
  events: ReviewInteractionEvent[],
): ReviewProductConversionSummary[] {
  const byProduct = new Map<
    string,
    { reviewImpressions: number; reviewInteractions: number; attributedConversions: number }
  >();
  for (const e of events) {
    if (
      ["review_impression", "review_click", "review_expand", "review_helpful_click", "review_summary_view", "personalized_review_view"].includes(
        e.eventType,
      )
    ) {
      const cur = byProduct.get(e.productId) ?? {
        reviewImpressions: 0,
        reviewInteractions: 0,
        attributedConversions: 0,
      };
      if (e.eventType === "review_impression") cur.reviewImpressions++;
      cur.reviewInteractions++;
      byProduct.set(e.productId, cur);
    }
  }
  for (const a of attributions) {
    const cur = byProduct.get(a.productId) ?? {
      reviewImpressions: 0,
      reviewInteractions: 0,
      attributedConversions: 0,
    };
    cur.attributedConversions += a.attributionScore;
    byProduct.set(a.productId, cur);
  }
  return [...byProduct.entries()].map(([productId, s]) => ({
    productId,
    reviewImpressions: s.reviewImpressions,
    reviewInteractions: s.reviewInteractions,
    attributedConversions: s.attributedConversions,
    reviewAssistRate:
      s.reviewInteractions > 0 ? s.attributedConversions / s.reviewInteractions : 0,
  }));
}
