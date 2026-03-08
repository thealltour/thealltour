/**
 * PR18: 요약 생성기 인터페이스.
 * - 현재는 규칙 기반 생성기만 export.
 * - 추후 LLM 기반 생성기로 교체 가능.
 */
import type { ProductReviewSummary } from "@/types/reviewSummaries";
import type { ReviewForSummary } from "@/lib/reviewSummaryBuilder";
import { summarizeProductReviews } from "@/lib/reviewSummaryBuilder";

export interface ReviewSummaryGenerator {
  generate(productReviews: ReviewForSummary[], productId: string): ProductReviewSummary;
}

export const ruleBasedReviewSummaryGenerator: ReviewSummaryGenerator = {
  generate(productReviews, productId) {
    return summarizeProductReviews(productReviews, productId);
  },
};
