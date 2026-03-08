/**
 * PR28: 상품별 리뷰 인사이트 리포트 생성.
 * 순수 함수, UI 의존 없음.
 */
import type {
  ProductReviewInsightReport,
  ProductReviewHealth,
  ProductReviewHealthSummary,
  ProductReviewSentiment,
} from "@/types/reviewProductInsights";
import type { ReviewForInsight, ProductReviewSummaryLike } from "./reviewInsightSelectors";
import {
  groupReviewsByProduct,
  getProductReviewSummaryMap,
  getProductAnomalyMap,
  getProductConversionMap,
  getProductModerationMap,
  getProductTrustAggregates,
} from "./reviewInsightSelectors";
import type { ReviewAnomalyResult } from "@/types/reviewAnomalies";
import type { ReviewProductConversionSummary } from "@/types/reviewConversionAnalytics";
import {
  extractTopStrengthsFromReviews,
  extractTopWeaknessesFromReviews,
  extractRecurringComplaints,
  extractRecommendationDrivers,
  extractConversionDrivers,
} from "./reviewInsightExtraction";
import {
  buildOperationalSuggestions,
  buildImprovementPriorities,
  buildInsightWarnings,
} from "./reviewOperationalInsights";
import { buildProductTrendSummary } from "./reviewInsightTrends";

const MIN_REVIEWS_FOR_HEALTH = 2;
const HEALTHY_AVG_RATING = 4.0;
const WATCH_AVG_RATING = 3.3;
const LOW_TRUST_RATIO_WATCH = 0.25;
const LOW_TRUST_RATIO_RISK = 0.5;

export interface ProductInsightInput {
  reviews: ReviewForInsight[];
  summaries: ProductReviewSummaryLike[];
  anomalyResult: ReviewAnomalyResult | null;
  conversionProductSummaries: ReviewProductConversionSummary[];
  moderationReviews: Array<{ product_id?: string | null; status?: string; report_count?: number }>;
}

/**
 * 전체 상품 리뷰 데이터를 받아 상품별 인사이트 리포트 배열 생성.
 */
export function buildProductReviewInsightReports(input: ProductInsightInput): ProductReviewInsightReport[] {
  const byProduct = groupReviewsByProduct(input.reviews);
  const summaryMap = getProductReviewSummaryMap(input.summaries);
  const anomalyMap = getProductAnomalyMap(input.anomalyResult);
  const conversionMap = getProductConversionMap(input.conversionProductSummaries);
  const moderationMap = getProductModerationMap(input.moderationReviews);
  const trustAggregates = getProductTrustAggregates(byProduct);

  const reports: ProductReviewInsightReport[] = [];
  for (const [productId, reviews] of byProduct) {
    const summary = summaryMap.get(productId) ?? null;
    const ratingDrop = anomalyMap.ratingDropByProduct.get(productId) ?? null;
    const conversionSummary = conversionMap.get(productId) ?? null;
    const moderation = moderationMap.get(productId) ?? { flaggedCount: 0, underReviewCount: 0 };
    const trust = trustAggregates.get(productId) ?? { lowTrustRatio: 0, avgTrust: 0, totalReviews: 0 };
    const suspiciousCount = anomalyMap.suspiciousCountByProduct.get(productId) ?? 0;
    const alerts = anomalyMap.alertsByProduct.get(productId) ?? [];

    const sourceData = {
      reviews,
      reviewSummary: summary,
      anomalyData: input.anomalyResult
        ? {
            ratingDropProducts: ratingDrop ? [ratingDrop] : [],
            surgeProducts: [],
            suspiciousReviews: [],
            alerts,
          }
        : null,
      conversionData: conversionSummary,
      moderationData: moderation,
      trustAggregates: trust,
      suspiciousCount,
      ratingDrop: ratingDrop ?? undefined,
    };
    const report = buildSingleProductReviewInsightReport(productId, sourceData);
    reports.push(report);
  }

  reports.sort((a, b) => {
    const order: Record<ProductReviewHealth, number> = { risk: 0, watch: 1, healthy: 2 };
    const healthOrder = (order[a.reviewHealth] ?? 2) - (order[b.reviewHealth] ?? 2);
    if (healthOrder !== 0) return healthOrder;
    return b.totalReviews - a.totalReviews;
  });
  return reports;
}

/**
 * 단일 상품에 대한 인사이트 리포트 생성.
 */
export function buildSingleProductReviewInsightReport(
  productId: string,
  sourceData: {
    reviews: ReviewForInsight[];
    reviewSummary?: ProductReviewSummaryLike | null;
    anomalyData?: unknown;
    conversionData?: ReviewProductConversionSummary | null;
    moderationData?: { flaggedCount: number; underReviewCount: number };
    trustAggregates?: { lowTrustRatio: number; avgTrust: number };
    suspiciousCount?: number;
    ratingDrop?: import("@/types/reviewAnomalies").RatingDropProduct | null;
  },
): ProductReviewInsightReport {
  const reviews = sourceData.reviews ?? [];
  const summary = sourceData.reviewSummary ?? null;
  const conversionSummary = sourceData.conversionData ?? null;
  const moderation = sourceData.moderationData ?? { flaggedCount: 0, underReviewCount: 0 };
  const trust = sourceData.trustAggregates ?? { lowTrustRatio: 0, avgTrust: 0 };
  const now = new Date().toISOString();

  const healthSummary = determineProductReviewHealth(productId, {
    reviews,
    summary,
    ratingDrop: sourceData.anomalyData && Array.isArray((sourceData.anomalyData as { ratingDropProducts?: unknown[] }).ratingDropProducts)
      ? (sourceData.anomalyData as { ratingDropProducts: { productId: string; ratingDelta: number }[] }).ratingDropProducts[0]
      : null,
    suspiciousCount: sourceData.suspiciousCount ?? 0,
    moderation,
    trust,
    conversionSummary,
  });

  const avgRating =
    reviews.filter((r) => typeof r.rating === "number").length > 0
      ? reviews.reduce((s, r) => s + (r.rating ?? 0), 0) /
        reviews.filter((r) => typeof r.rating === "number").length
      : summary?.average_rating ?? 0;
  const sentiment: ProductReviewSentiment =
    avgRating >= 4.2 ? "positive" : avgRating >= 3.5 ? "mixed" : "negative";

  const summaryText =
    reviews.length < 3
      ? "리뷰 수가 적어 인사이트 정확도가 낮을 수 있습니다."
      : (summary?.summary_text?.trim() ||
          `평균 ${avgRating.toFixed(1)}점, ${reviews.length}건의 리뷰가 수집되었습니다.`);

  const topStrengths = extractTopStrengthsFromReviews(reviews, summary);
  const topWeaknesses = extractTopWeaknessesFromReviews(reviews, summary);
  const recurringComplaints = extractRecurringComplaints(reviews, 40);
  const recommendationDrivers = extractRecommendationDrivers(reviews, summary);
  const conversionDrivers = extractConversionDrivers(conversionSummary, reviews);

  const warnings = buildInsightWarnings({
    reviews,
    anomalyData: sourceData.anomalyData as import("@/types/reviewAnomalies").ReviewAnomalyResult | undefined,
    moderationData: moderation,
    trustAggregates: trust,
  });

  const report: ProductReviewInsightReport = {
    productId,
    totalReviews: reviews.length,
    averageRating: Math.round(avgRating * 100) / 100,
    sentiment,
    reviewHealth: healthSummary.reviewHealth,
    summaryText,
    topStrengths,
    topWeaknesses,
    recurringComplaints,
    recommendationDrivers,
    conversionDrivers,
    trustWarnings: warnings.trustWarnings,
    anomalyWarnings: warnings.anomalyWarnings,
    moderationWarnings: warnings.moderationWarnings,
    operationalSuggestions: [],
    improvementPriorities: [],
    trendSummary: "",
    generatedAt: now,
  };

  report.operationalSuggestions = buildOperationalSuggestions(report);
  report.improvementPriorities = buildImprovementPriorities(report);
  report.trendSummary = buildProductTrendSummary({
    reviews,
    ratingDrop: sourceData.ratingDrop ?? null,
    conversionSummary,
    recentComplaintCount: recurringComplaints.length,
  });

  return report;
}

/**
 * 상품 리뷰 상태를 healthy / watch / risk 로 판정.
 */
export function determineProductReviewHealth(
  productId: string,
  sourceData: {
    reviews: ReviewForInsight[];
    summary?: ProductReviewSummaryLike | null;
    ratingDrop?: { ratingDelta: number } | null;
    suspiciousCount?: number;
    moderation?: { flaggedCount: number; underReviewCount: number };
    trust?: { lowTrustRatio: number };
    conversionSummary?: ReviewProductConversionSummary | null;
  },
): ProductReviewHealthSummary {
  const pid = productId;
  const reviews = sourceData.reviews ?? [];
  const reasons: string[] = [];
  let health: ProductReviewHealth = "healthy";

  if (reviews.length < MIN_REVIEWS_FOR_HEALTH) {
    return { productId: pid, reviewHealth: "healthy", reasons: ["리뷰 수가 적어 상태 판정을 보류합니다."] };
  }

  const avgRating =
    reviews.reduce((s, r) => s + (r.rating ?? 0), 0) /
    (reviews.filter((r) => typeof r.rating === "number").length || 1);
  const lowTrustRatio = sourceData.trust?.lowTrustRatio ?? 0;
  const flaggedCount = sourceData.moderation?.flaggedCount ?? 0;
  const underReviewCount = sourceData.moderation?.underReviewCount ?? 0;
  const suspiciousCount = sourceData.suspiciousCount ?? 0;
  const ratingDrop = sourceData.ratingDrop;
  const conversionRate = sourceData.conversionSummary?.reviewInteractions
    ? (sourceData.conversionSummary.attributedConversions ?? 0) / sourceData.conversionSummary.reviewInteractions
    : 0;

  if (
    (ratingDrop && ratingDrop.ratingDelta <= -1) ||
    avgRating < WATCH_AVG_RATING ||
    lowTrustRatio >= LOW_TRUST_RATIO_RISK ||
    flaggedCount >= 2 ||
    suspiciousCount >= 3
  ) {
    health = "risk";
    if (ratingDrop && ratingDrop.ratingDelta <= -1) reasons.push("평점 급락");
    if (avgRating < WATCH_AVG_RATING) reasons.push("평균 평점 낮음");
    if (lowTrustRatio >= LOW_TRUST_RATIO_RISK) reasons.push("저신뢰 리뷰 비율 높음");
    if (flaggedCount >= 2) reasons.push("플래그/신고 리뷰 다수");
    if (suspiciousCount >= 3) reasons.push("의심 리뷰 다수");
  } else if (
    (ratingDrop && ratingDrop.ratingDelta <= -0.5) ||
    avgRating < HEALTHY_AVG_RATING ||
    lowTrustRatio >= LOW_TRUST_RATIO_WATCH ||
    flaggedCount >= 1 ||
    underReviewCount >= 2 ||
    suspiciousCount >= 1 ||
    (sourceData.conversionSummary && conversionRate < 0.02 && sourceData.conversionSummary.reviewInteractions >= 20)
  ) {
    health = "watch";
    if (ratingDrop && ratingDrop.ratingDelta <= -0.5) reasons.push("최근 평점 하락");
    if (avgRating < HEALTHY_AVG_RATING) reasons.push("평균 평점 주의");
    if (lowTrustRatio >= LOW_TRUST_RATIO_WATCH) reasons.push("저신뢰 리뷰 일부 존재");
    if (flaggedCount >= 1) reasons.push("플래그 리뷰 있음");
    if (underReviewCount >= 2) reasons.push("검토 대상 리뷰 누적");
    if (suspiciousCount >= 1) reasons.push("의심 리뷰 감지");
  }

  if (reasons.length === 0 && health === "healthy") {
    reasons.push("현재 뚜렷한 위험 신호 없음");
  }
  return { productId: pid, reviewHealth: health, reasons };
}
