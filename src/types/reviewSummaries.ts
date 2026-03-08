/**
 * PR18: 관리자 리뷰 요약 대시보드용 타입.
 * (PR14 product_review_summaries DB 엔티티와 별개, 인메모리 요약 결과)
 */

export type ReviewSummarySentiment = "positive" | "mixed" | "negative";

export interface ProductReviewSummary {
  productId: string;
  totalReviews: number;
  averageRating: number;
  sentiment: ReviewSummarySentiment;
  summaryText: string;
  highlights: string[];
  pros: string[];
  cons: string[];
  recommendedFor: string[];
  cautionPoints: string[];
  topKeywords: string[];
  recentTrendSummary: string;
}
