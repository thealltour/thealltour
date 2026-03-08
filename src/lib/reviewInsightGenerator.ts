/**
 * PR28: 인사이트 생성기 인터페이스.
 * 향후 AI 생성기로 교체 가능한 구조. 이번 PR에서는 규칙 기반만 사용.
 */
import type { ProductReviewInsightReport } from "@/types/reviewProductInsights";
import type { ProductReviewInsightSourceData } from "@/types/reviewProductInsights";
import { buildSingleProductReviewInsightReport } from "./reviewProductInsights";
import type { ReviewForInsight } from "./reviewInsightSelectors";
import type { ProductReviewSummaryLike } from "./reviewInsightSelectors";
import type { ReviewProductConversionSummary } from "@/types/reviewConversionAnalytics";

export interface ReviewInsightGenerator {
  generate(
    productId: string,
    sourceData: ProductReviewInsightSourceData & {
      reviews: ReviewForInsight[];
      reviewSummary?: ProductReviewSummaryLike | null;
      conversionData?: ReviewProductConversionSummary | null;
      moderationData?: { flaggedCount: number; underReviewCount: number };
      trustAggregates?: { lowTrustRatio: number; avgTrust: number };
      suspiciousCount?: number;
      anomalyData?: unknown;
    },
  ): ProductReviewInsightReport;
}

export const ruleBasedReviewInsightGenerator: ReviewInsightGenerator = {
  generate(productId, sourceData) {
    return buildSingleProductReviewInsightReport(productId, {
      reviews: sourceData.reviews,
      reviewSummary: sourceData.reviewSummary,
      anomalyData: sourceData.anomalyData,
      conversionData: sourceData.conversionData,
      moderationData: sourceData.moderationData,
      trustAggregates: sourceData.trustAggregates,
      suspiciousCount: sourceData.suspiciousCount,
    });
  },
};
