/**
 * PR6: 공개 리뷰 노출용 통계·목록 조회.
 * - submitted만 노출, draft/hidden 제외.
 * - PR15: 추천순은 점수(recommendationScore) 기반 정렬.
 */
import "server-only";

import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sortReviewsByRecommendation } from "@/lib/reviewRanking";
import type {
  PublicReviewItem,
  ProductReviewStats,
  ReviewSortOption,
} from "@/types/review";

const PUBLIC_STATUS = "submitted";

function toPublicReviewItem(row: Record<string, unknown>): PublicReviewItem {
  const imageUrls = Array.isArray(row.image_urls)
    ? (row.image_urls as string[]).filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];
  const legacyUrl = typeof row.image_url === "string" ? row.image_url : undefined;
  const booking = row.travel_bookings as Record<string, unknown> | null | undefined;
  const productId = booking && typeof booking.product_id !== "undefined" ? booking.product_id : undefined;
  const productTitle = booking && typeof booking.product_title === "string" ? booking.product_title : null;

  const rating =
    typeof row.rating === "number" && Number.isFinite(row.rating) && row.rating >= 1 && row.rating <= 5
      ? Math.round(row.rating) as 1 | 2 | 3 | 4 | 5
      : undefined;

  const parseRating = (val: unknown): number | undefined => {
    if (typeof val === "number" && Number.isFinite(val) && val >= 1 && val <= 5) return Math.round(val);
    return undefined;
  };

  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    summary: typeof row.summary === "string" ? row.summary : undefined,
    content: String(row.content ?? ""),
    author_name: String(row.author_name ?? ""),
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    rating,
    image_url: legacyUrl,
    image_urls: imageUrls.length > 0 ? imageUrls : legacyUrl ? [legacyUrl] : [],
    eligibility_id: typeof row.eligibility_id === "string" ? row.eligibility_id : undefined,
    booking_id: typeof row.booking_id === "string" ? row.booking_id : undefined,
    product_id: productId != null ? String(productId) : undefined,
    product_title: productTitle ?? undefined,
    status: row.status === "submitted" ? "submitted" : undefined,
    content_good: typeof row.content_good === "string" ? row.content_good : undefined,
    content_bad: typeof row.content_bad === "string" ? row.content_bad : undefined,
    content_tip: typeof row.content_tip === "string" ? row.content_tip : undefined,
    rating_schedule: parseRating(row.rating_schedule),
    rating_stay: parseRating(row.rating_stay),
    rating_guide: parseRating(row.rating_guide),
    rating_food: parseRating(row.rating_food),
    helpfulCount: typeof row.helpfulCount === "number" ? row.helpfulCount : undefined,
    viewerVotedHelpful: row.viewerVotedHelpful === true,
  };
}

/**
 * 공개 리뷰만 조회 (submitted, hidden 제외).
 * 옵션: productId, onlyVerified, onlyWithImages, minRating, sort.
 */
export type GetPublicReviewsOptions = {
  productId?: string;
  onlyVerified?: boolean;
  onlyWithImages?: boolean;
  minRating?: 1 | 2 | 3 | 4 | 5;
  sort?: ReviewSortOption;
  limit?: number;
  offset?: number;
  /** PR8: 이 회원이 도움됨 투표한 리뷰 표시용 */
  viewerMemberId?: string;
  /** 검색어: title, summary, content ilike (OR) */
  searchText?: string;
};

export async function getPublicReviews(
  options: GetPublicReviewsOptions = {},
): Promise<PublicReviewItem[]> {
  const {
    productId,
    onlyVerified,
    onlyWithImages,
    minRating,
    sort = "latest",
    limit = 100,
    offset = 0,
    viewerMemberId,
    searchText,
  } = options;

  const isRecommended = sort === "recommended";
  const fetchLimit = isRecommended ? Math.min(offset + limit, 500) : offset + limit;

  let query = supabaseAdmin
    .from("reviews")
    .select("*, travel_bookings(product_id, product_title)")
    .eq("status", PUBLIC_STATUS);

  if (searchText?.trim()) {
    const term = `%${searchText.trim()}%`;
    query = query.or(`title.ilike.${term},summary.ilike.${term},content.ilike.${term}`);
  }

  if (productId) {
    const { data: bookings } = await supabaseAdmin
      .from("travel_bookings")
      .select("id")
      .eq("product_id", productId);
    const bookingIds = (bookings ?? []).map((b) => (b as { id: string }).id).filter(Boolean);
    if (bookingIds.length === 0) return [];
    query = query.in("booking_id", bookingIds);
  }

  if (onlyVerified) {
    query = query.not("eligibility_id", "is", null);
  }

  if (minRating != null) {
    query = query.gte("rating", minRating);
  }

  switch (sort) {
    case "rating":
    case "rating_high":
      query = query.order("rating", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
      break;
    case "rating_low":
      query = query.order("rating", { ascending: true, nullsFirst: true }).order("created_at", { ascending: false });
      break;
    case "verified_first":
      query = query.order("eligibility_id", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
      break;
    case "recommended":
    case "helpful":
    case "photo":
      query = query.order("created_at", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  query = query.range(0, fetchLimit - 1);

  const { data, error } = await query;
  if (error) return [];

  let items = (data ?? []).map((row) => toPublicReviewItem(row as Record<string, unknown>));

  if (onlyWithImages) {
    items = items.filter((r) => r.image_urls.length > 0 || !!r.image_url);
  }

  const reviewIds = items.map((r) => r.id);
  if (reviewIds.length > 0) {
    const { data: votesRows } = await supabase
      .from("review_votes")
      .select("review_id")
      .eq("vote_type", "helpful")
      .in("review_id", reviewIds);
    const countMap = new Map<string, number>();
    for (const r of votesRows ?? []) {
      const id = (r as { review_id: string }).review_id;
      countMap.set(id, (countMap.get(id) ?? 0) + 1);
    }
    let viewerVotedIds = new Set<string>();
    let viewerReportedIds = new Set<string>();
    if (viewerMemberId) {
      const [votesRes, reportsRes] = await Promise.all([
        supabase
          .from("review_votes")
          .select("review_id")
          .eq("member_id", viewerMemberId)
          .eq("vote_type", "helpful")
          .in("review_id", reviewIds),
        supabaseAdmin
          .from("review_reports")
          .select("review_id")
          .eq("member_id", viewerMemberId)
          .in("review_id", reviewIds),
      ]);
      viewerVotedIds = new Set((votesRes.data ?? []).map((v) => (v as { review_id: string }).review_id));
      viewerReportedIds = new Set((reportsRes.data ?? []).map((r) => (r as { review_id: string }).review_id));
    }
    items = items.map((r) => ({
      ...r,
      helpfulCount: countMap.get(r.id) ?? 0,
      viewerVotedHelpful: viewerVotedIds.has(r.id),
      viewerReported: viewerReportedIds.has(r.id),
    }));
  }

  if (sort === "verified_first") {
    items = [...items].sort((a, b) => {
      const aVer = a.eligibility_id ? 1 : 0;
      const bVer = b.eligibility_id ? 1 : 0;
      if (bVer !== aVer) return bVer - aVer;
      const aDate = a.created_at ?? "";
      const bDate = b.created_at ?? "";
      return bDate.localeCompare(aDate);
    });
  }

  if (sort === "photo") {
    items = [...items].sort((a, b) => {
      const aHas = (a.image_urls?.length ?? 0) > 0 || !!a.image_url ? 1 : 0;
      const bHas = (b.image_urls?.length ?? 0) > 0 || !!b.image_url ? 1 : 0;
      if (bHas !== aHas) return bHas - aHas;
      const aDate = a.created_at ?? "";
      const bDate = b.created_at ?? "";
      return bDate.localeCompare(aDate);
    });
  }

  if (sort === "helpful") {
    items = [...items].sort((a, b) => {
      const aCount = a.helpfulCount ?? 0;
      const bCount = b.helpfulCount ?? 0;
      if (bCount !== aCount) return bCount - aCount;
      const aDate = a.created_at ?? "";
      const bDate = b.created_at ?? "";
      return bDate.localeCompare(aDate);
    });
  }

  if (sort === "recommended") {
    const sorted = sortReviewsByRecommendation(items);
    items = sorted.map((r) => ({
      ...r,
      recommendationScore: r.recommendationScore,
    }));
  }

  return items.slice(offset, offset + limit);
}

/**
 * 상품별 리뷰 통계.
 * 해당 상품의 booking_id로 연결된 submitted 리뷰만 집계.
 */
export async function getProductReviewStats(productId: string): Promise<ProductReviewStats> {
  const { data: bookings } = await supabaseAdmin
    .from("travel_bookings")
    .select("id")
    .eq("product_id", productId);
  const bookingIds = (bookings ?? []).map((b) => (b as { id: string }).id).filter(Boolean);
  if (bookingIds.length === 0) {
    return {
      averageRating: 0,
      reviewCount: 0,
      verifiedCount: 0,
      photoCount: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }

  const { data, error } = await supabase
    .from("reviews")
    .select("rating, eligibility_id, image_url, image_urls")
    .eq("status", PUBLIC_STATUS)
    .in("booking_id", bookingIds);

  if (error) {
    return {
      averageRating: 0,
      reviewCount: 0,
      verifiedCount: 0,
      photoCount: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }

  const rows = data ?? [];
  const reviewCount = rows.length;
  const dist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sumRating = 0;
  let verifiedCount = 0;
  let photoCount = 0;

  for (const r of rows as Array<{ rating?: number; eligibility_id?: string; image_url?: string; image_urls?: string[] }>) {
    const rating = typeof r.rating === "number" && r.rating >= 1 && r.rating <= 5 ? Math.round(r.rating) as 1 | 2 | 3 | 4 | 5 : null;
    if (rating != null) {
      dist[rating]++;
      sumRating += rating;
    }
    if (r.eligibility_id) verifiedCount++;
    const urls = Array.isArray(r.image_urls) ? r.image_urls : [];
    if (urls.length > 0 || r.image_url) photoCount++;
  }

  const averageRating = reviewCount > 0 ? Math.round((sumRating / reviewCount) * 10) / 10 : 0;

  return {
    averageRating,
    reviewCount,
    verifiedCount,
    photoCount,
    ratingDistribution: dist,
  };
}

/**
 * 상품별 공개 리뷰 목록 (submitted만, hidden 제외).
 */
export async function getProductReviews(
  productId: string,
  options: { limit?: number; offset?: number; sort?: ReviewSortOption; viewerMemberId?: string } = {},
): Promise<PublicReviewItem[]> {
  return getPublicReviews({
    productId,
    sort: options.sort ?? "latest",
    limit: options.limit ?? 20,
    offset: options.offset ?? 0,
    viewerMemberId: options.viewerMemberId,
  });
}

/**
 * 단건 공개 리뷰 조회. submitted만 반환, draft/hidden이면 null.
 */
export async function getPublicReviewById(
  reviewId: string,
  options?: { viewerMemberId?: string },
): Promise<PublicReviewItem | null> {
  const { data, error } = await supabaseAdmin
    .from("reviews")
    .select("*, travel_bookings(product_id, product_title)")
    .eq("id", reviewId)
    .eq("status", PUBLIC_STATUS)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const item = toPublicReviewItem(data as Record<string, unknown>);

  const { count } = await supabase
    .from("review_votes")
    .select("id", { count: "exact", head: true })
    .eq("review_id", reviewId)
    .eq("vote_type", "helpful");
  item.helpfulCount = count ?? 0;

  if (options?.viewerMemberId) {
    const [voteRes, reportRes] = await Promise.all([
      supabase
        .from("review_votes")
        .select("id")
        .eq("review_id", reviewId)
        .eq("member_id", options.viewerMemberId)
        .eq("vote_type", "helpful")
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("review_reports")
        .select("id")
        .eq("review_id", reviewId)
        .eq("member_id", options.viewerMemberId)
        .limit(1)
        .maybeSingle(),
    ]);
    item.viewerVotedHelpful = !!voteRes.data;
    item.viewerReported = !!reportRes.data;
  }

  return item;
}

/** 인증 후기 여부: eligibility_id 있으면 true */
export function isVerifiedReview(review: { eligibility_id?: string }): boolean {
  return !!review.eligibility_id;
}
