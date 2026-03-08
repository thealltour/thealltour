/**
 * PR19: 관리자 리뷰 검색/필터/정렬 유틸.
 */
import { calculateReviewScore } from "@/lib/reviewRanking";
import type { PublicReviewItem } from "@/types/review";
import type {
  ReviewSearchFiltersState,
  ReviewSortOption,
} from "@/types/reviewSearch";
import {
  normalizeSearchText,
  getReviewImageCount,
  RECOMMENDATION_BAND_THRESHOLDS,
} from "@/lib/reviewSearchConstants";

export type AdminReviewItemForFilter = PublicReviewItem & { recommendationScore?: number };

/**
 * 키워드 검색: content, title, product_id, id.
 */
export function searchReviewsByKeyword(
  reviews: AdminReviewItemForFilter[],
  query: string,
): AdminReviewItemForFilter[] {
  const q = normalizeSearchText(query);
  if (!q) return reviews;
  return reviews.filter((r) => {
    const content = (r.content ?? "").toLowerCase();
    const title = (r.title ?? "").toLowerCase();
    const productId = (r.product_id ?? "").toLowerCase();
    const id = (r.id ?? "").toLowerCase();
    return (
      content.includes(q) ||
      title.includes(q) ||
      productId.includes(q) ||
      id.includes(q) ||
      (r.author_name && r.author_name.toLowerCase().includes(q))
    );
  });
}

export function filterByRating(
  reviews: AdminReviewItemForFilter[],
  rating: number | "all",
): AdminReviewItemForFilter[] {
  if (rating === "all") return reviews;
  return reviews.filter((r) => r.rating === rating);
}

export function filterByVerified(
  reviews: AdminReviewItemForFilter[],
  verified: "all" | "verified" | "unverified",
): AdminReviewItemForFilter[] {
  if (verified === "all") return reviews;
  const hasEligibility = (r: AdminReviewItemForFilter) => !!r.eligibility_id;
  if (verified === "verified") return reviews.filter(hasEligibility);
  return reviews.filter((r) => !hasEligibility(r));
}

export function filterByImages(
  reviews: AdminReviewItemForFilter[],
  hasImages: "all" | "with_images" | "without_images",
): AdminReviewItemForFilter[] {
  if (hasImages === "all") return reviews;
  const withImg = (r: AdminReviewItemForFilter) => getReviewImageCount(r) > 0;
  if (hasImages === "with_images") return reviews.filter(withImg);
  return reviews.filter((r) => !withImg(r));
}

export function filterByHelpfulMin(
  reviews: AdminReviewItemForFilter[],
  helpfulMin: number | null,
): AdminReviewItemForFilter[] {
  if (helpfulMin == null || helpfulMin <= 0) return reviews;
  return reviews.filter((r) => (r.helpfulCount ?? 0) >= helpfulMin);
}

function parseDateSafe(s: string | null): number | null {
  if (!s || typeof s !== "string") return null;
  const t = new Date(s.trim()).getTime();
  return Number.isNaN(t) ? null : t;
}

/** dateTo는 해당일 끝(23:59:59.999)까지 포함 */
function parseDateToEnd(s: string | null): number | null {
  if (!s || typeof s !== "string") return null;
  const d = new Date(s.trim());
  d.setHours(23, 59, 59, 999);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

export function filterByDateRange(
  reviews: AdminReviewItemForFilter[],
  dateFrom: string | null,
  dateTo: string | null,
): AdminReviewItemForFilter[] {
  const from = parseDateSafe(dateFrom);
  const to = parseDateToEnd(dateTo);
  if (from == null && to == null) return reviews;
  return reviews.filter((r) => {
    const created = parseDateSafe(r.created_at ?? null);
    if (created == null) return false;
    if (from != null && created < from) return false;
    if (to != null && created > to) return false;
    return true;
  });
}

/**
 * recommendationBand 필터. 점수는 호출 전에 부여되어 있어야 함.
 */
export function filterByRecommendationBand(
  reviews: AdminReviewItemForFilter[],
  band: "all" | "high" | "medium" | "low",
): AdminReviewItemForFilter[] {
  if (band === "all") return reviews;
  const { high, medium } = RECOMMENDATION_BAND_THRESHOLDS;
  return reviews.filter((r) => {
    const score = r.recommendationScore ?? 0;
    if (band === "high") return score >= high;
    if (band === "medium") return score >= medium && score < high;
    return score < medium;
  });
}

/**
 * 모든 필터 적용.
 */
export function filterReviews(
  reviews: AdminReviewItemForFilter[],
  filters: ReviewSearchFiltersState,
): AdminReviewItemForFilter[] {
  let list = searchReviewsByKeyword(reviews, filters.query);
  if (filters.productId.trim()) {
    const pid = filters.productId.trim().toLowerCase();
    list = list.filter((r) => (r.product_id ?? "").toLowerCase().includes(pid));
  }
  list = filterByRating(list, filters.rating);
  list = filterByVerified(list, filters.verified);
  list = filterByImages(list, filters.hasImages);
  list = filterByHelpfulMin(list, filters.helpfulMin);
  list = filterByDateRange(list, filters.dateFrom, filters.dateTo);
  list = filterByRecommendationBand(list, filters.recommendationBand);
  return list;
}

export function sortReviews(
  reviews: AdminReviewItemForFilter[],
  sortBy: ReviewSortOption,
): AdminReviewItemForFilter[] {
  const list = [...reviews];
  switch (sortBy) {
    case "newest":
      list.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
      break;
    case "oldest":
      list.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
      break;
    case "rating_desc":
      list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
    case "rating_asc":
      list.sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0));
      break;
    case "helpful_desc":
      list.sort((a, b) => (b.helpfulCount ?? 0) - (a.helpfulCount ?? 0));
      break;
    case "helpful_asc":
      list.sort((a, b) => (a.helpfulCount ?? 0) - (b.helpfulCount ?? 0));
      break;
    case "recommendation_desc":
      list.sort((a, b) => (b.recommendationScore ?? 0) - (a.recommendationScore ?? 0));
      break;
    default:
      list.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  }
  return list;
}

/**
 * 리뷰 배열에 recommendationScore 부여 (필터/정렬 전에 한 번 호출).
 */
export function attachRecommendationScores(
  reviews: PublicReviewItem[],
): AdminReviewItemForFilter[] {
  return reviews.map((r) => ({
    ...r,
    recommendationScore: calculateReviewScore(r),
  }));
}
