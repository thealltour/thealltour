/**
 * PR19: 리뷰 검색/필터 상수 및 보조.
 */
import type { ReviewSearchFiltersState } from "@/types/reviewSearch";

export const DEFAULT_REVIEW_FILTERS: ReviewSearchFiltersState = {
  query: "",
  productId: "",
  rating: "all",
  verified: "all",
  hasImages: "all",
  helpfulMin: null,
  dateFrom: null,
  dateTo: null,
  recommendationBand: "all",
  trustBand: "all",
  sortBy: "newest",
};

export const RECOMMENDATION_BAND_THRESHOLDS = {
  high: 80,
  medium: 50,
} as const;

export const REVIEW_SORT_OPTIONS: { value: ReviewSearchFiltersState["sortBy"]; label: string }[] = [
  { value: "newest", label: "최신순" },
  { value: "oldest", label: "오래된순" },
  { value: "rating_desc", label: "평점 높은순" },
  { value: "rating_asc", label: "평점 낮은순" },
  { value: "helpful_desc", label: "도움수 높은순" },
  { value: "helpful_asc", label: "도움수 낮은순" },
  { value: "recommendation_desc", label: "추천점수 높은순" },
];

export function normalizeSearchText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getReviewImageCount(review: { image_url?: string; image_urls?: string[] }): number {
  const urls = review.image_urls ?? [];
  if (urls.length > 0) return urls.length;
  return review.image_url && String(review.image_url).trim() ? 1 : 0;
}

export function getReviewContentPreview(content: string | undefined, maxLength = 120): string {
  if (!content || typeof content !== "string") return "";
  const s = content.trim().replace(/\s+/g, " ");
  if (s.length <= maxLength) return s;
  return s.slice(0, maxLength) + "…";
}

export function isReviewWithImages(review: { image_url?: string; image_urls?: string[] }): boolean {
  return getReviewImageCount(review) > 0;
}
