/**
 * PR19: 관리자 리뷰 검색/필터 타입.
 */

export type ReviewVerifiedFilter = "all" | "verified" | "unverified";
export type ReviewImageFilter = "all" | "with_images" | "without_images";
export type ReviewRecommendationBand = "all" | "high" | "medium" | "low";
/** PR21: Trust Score 구간 필터 */
export type ReviewTrustBandFilter = "all" | "high" | "medium" | "low" | "risk";
export type ReviewSortOption =
  | "newest"
  | "oldest"
  | "rating_desc"
  | "rating_asc"
  | "helpful_desc"
  | "helpful_asc"
  | "recommendation_desc";

export interface ReviewSearchFiltersState {
  query: string;
  productId: string;
  rating: number | "all";
  verified: ReviewVerifiedFilter;
  hasImages: ReviewImageFilter;
  helpfulMin: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  recommendationBand: ReviewRecommendationBand;
  /** PR21: Trust Score 구간 */
  trustBand: ReviewTrustBandFilter;
  sortBy: ReviewSortOption;
}

/** 관리자 목록용 리뷰 항목 (PublicReviewItem + recommendationScore 등) */
export type AdminReviewListItem = import("@/types/review").PublicReviewItem & {
  recommendationScore?: number;
  /** PR20: DB status (submitted/hidden/under_review/flagged) */
  status?: string;
  /** PR20: 신고 건수 (관리자용) */
  report_count?: number;
  /** PR21: Trust Score 0~100 */
  trustScore?: number;
};
