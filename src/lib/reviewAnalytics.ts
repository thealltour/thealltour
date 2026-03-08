/**
 * PR16: 관리자 리뷰 분석 데이터 로더 및 집계.
 * - submitted 리뷰만 분석 대상.
 * - 추천 점수는 reviewRanking.calculateReviewScore 사용.
 * - PR21: Trust Score 및 구간별 분포 계산.
 */
import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateReviewScore } from "@/lib/reviewRanking";
import { calculateReviewTrustScore } from "@/lib/reviewTrustScore";
import { normalizeReviewContent } from "@/lib/reviewAnomalyDetection";
import type { PublicReviewItem, ReviewStatus } from "@/types/review";
import type { ReviewAnalyticsResult } from "@/types/reviewAnalytics";

type ReviewWithTrust = PublicReviewItem & { trustScore?: number };

const PUBLIC_STATUS = "submitted";

function toAnalyticsReviewItem(
  row: Record<string, unknown>,
  helpfulCount: number,
): PublicReviewItem {
  const imageUrls = Array.isArray(row.image_urls)
    ? (row.image_urls as string[]).filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];
  const legacyUrl = typeof row.image_url === "string" ? row.image_url : undefined;
  const booking = row.travel_bookings as Record<string, unknown> | null | undefined;
  const productId = booking && typeof booking.product_id !== "undefined" ? booking.product_id : undefined;
  const productTitle = booking && typeof booking.product_title === "string" ? booking.product_title : null;

  const rating =
    typeof row.rating === "number" && Number.isFinite(row.rating) && row.rating >= 1 && row.rating <= 5
      ? (Math.round(row.rating) as 1 | 2 | 3 | 4 | 5)
      : undefined;

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
    status: (typeof row.status === "string" ? row.status : undefined) as ReviewStatus | undefined,
    reportCount: typeof row.report_count === "number" ? row.report_count : undefined,
    content_good: typeof row.content_good === "string" ? row.content_good : undefined,
    content_bad: typeof row.content_bad === "string" ? row.content_bad : undefined,
    content_tip: typeof row.content_tip === "string" ? row.content_tip : undefined,
    helpfulCount,
  };
}

/**
 * 분석용 제출된 리뷰 전체 로드.
 * product_id는 travel_bookings에서, helpful_count는 review_votes에서 집계.
 */
export async function getAllReviewsForAnalytics(): Promise<PublicReviewItem[]> {
  const { data: rows, error } = await supabaseAdmin
    .from("reviews")
    .select("id, title, summary, content, author_name, created_at, rating, image_url, image_urls, eligibility_id, booking_id, content_good, content_bad, content_tip, status, report_count")
    .eq("status", PUBLIC_STATUS)
    .order("created_at", { ascending: false });

  if (error || !rows || rows.length === 0) {
    return [];
  }

  const reviewIds = (rows as Record<string, unknown>[]).map((r) => String(r.id ?? "")).filter(Boolean);
  const countMap = new Map<string, number>();

  if (reviewIds.length > 0) {
    const batchSize = 200;
    for (let i = 0; i < reviewIds.length; i += batchSize) {
      const chunk = reviewIds.slice(i, i + batchSize);
      const { data: votes } = await supabaseAdmin
        .from("review_votes")
        .select("review_id")
        .eq("vote_type", "helpful")
        .in("review_id", chunk);
      for (const v of votes ?? []) {
        const id = (v as { review_id: string }).review_id;
        countMap.set(id, (countMap.get(id) ?? 0) + 1);
      }
    }
  }

  const bookingIds = (rows as Record<string, unknown>[])
    .map((r) => r.booking_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const uniqueBookingIds = [...new Set(bookingIds)];

  let bookingMap = new Map<string, { product_id: string; product_title: string | null }>();
  if (uniqueBookingIds.length > 0) {
    const { data: bookings } = await supabaseAdmin
      .from("travel_bookings")
      .select("id, product_id, product_title")
      .in("id", uniqueBookingIds);
    for (const b of bookings ?? []) {
      const row = b as { id: string; product_id: string; product_title: string | null };
      bookingMap.set(row.id, { product_id: row.product_id, product_title: row.product_title ?? null });
    }
  }

  return (rows as Record<string, unknown>[]).map((row) => {
    const bookingId = typeof row.booking_id === "string" ? row.booking_id : undefined;
    const booking = bookingId ? bookingMap.get(bookingId) : undefined;
    const withBooking = {
      ...row,
      travel_bookings: booking
        ? { product_id: booking.product_id, product_title: booking.product_title }
        : null,
    };
    const helpfulCount = countMap.get(String(row.id ?? "")) ?? 0;
    return toAnalyticsReviewItem(withBooking, helpfulCount);
  });
}

/**
 * 리뷰 목록으로 대시보드용 집계 결과 계산.
 * recommendationScore는 calculateReviewScore로 계산 후 정렬에 사용.
 * PR21: Trust Score 및 구간별 분포 계산.
 */
export function computeReviewAnalytics(reviews: PublicReviewItem[]): ReviewAnalyticsResult {
  const totalReviews = reviews.length;

  const byProduct = new Map<string, PublicReviewItem[]>();
  for (const r of reviews) {
    const pid = r.product_id?.trim();
    if (pid) {
      const list = byProduct.get(pid) ?? [];
      list.push(r);
      byProduct.set(pid, list);
    }
  }

  const duplicateByReviewId = new Map<string, boolean>();
  for (const [, list] of byProduct) {
    const normCount = new Map<string, number>();
    for (const r of list) {
      const n = normalizeReviewContent(r.content);
      if (n.length >= 10) normCount.set(n, (normCount.get(n) ?? 0) + 1);
    }
    for (const r of list) {
      const n = normalizeReviewContent(r.content);
      duplicateByReviewId.set(r.id, n.length >= 10 && (normCount.get(n) ?? 0) >= 2);
    }
  }

  const withTrust = reviews.map((r): ReviewWithTrust => {
    const trust = calculateReviewTrustScore(r, {
      duplicateContentInProduct: duplicateByReviewId.get(r.id) ?? false,
    });
    return { ...r, trustScore: trust.trustScore };
  });

  const trustScoreDistribution: ReviewAnalyticsResult["trustScoreDistribution"] = {
    "0-20": 0,
    "20-40": 0,
    "40-60": 0,
    "60-80": 0,
    "80-100": 0,
  };
  for (const r of withTrust) {
    const s = r.trustScore ?? 0;
    if (s < 20) trustScoreDistribution["0-20"]++;
    else if (s < 40) trustScoreDistribution["20-40"]++;
    else if (s < 60) trustScoreDistribution["40-60"]++;
    else if (s < 80) trustScoreDistribution["60-80"]++;
    else trustScoreDistribution["80-100"]++;
  }

  const ratings = withTrust
    .map((r) => r.rating)
    .filter((r): r is number => typeof r === "number" && r >= 1 && r <= 5);
  const sumRating = ratings.reduce((a, b) => a + b, 0);
  const averageRating = totalReviews > 0 ? Math.round((sumRating / ratings.length) * 10) / 10 : 0;

  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ratings) {
    ratingDistribution[r as 1 | 2 | 3 | 4 | 5]++;
  }

  const verifiedCount = withTrust.filter((r) => !!r.eligibility_id).length;
  const verifiedRatio = totalReviews > 0 ? Math.round((verifiedCount / totalReviews) * 1000) / 1000 : 0;

  const withScore = withTrust.map((r) => ({
    ...r,
    recommendationScore: calculateReviewScore(r),
  }));
  const topRecommendedReviews = [...withScore]
    .sort((a, b) => (b.recommendationScore ?? 0) - (a.recommendationScore ?? 0))
    .slice(0, 10);

  const topHelpfulReviews = [...withTrust]
    .sort((a, b) => (b.helpfulCount ?? 0) - (a.helpfulCount ?? 0))
    .slice(0, 10);

  const now = new Date();
  const dayKeys: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const countByDate = new Map<string, number>();
  for (const key of dayKeys) {
    countByDate.set(key, 0);
  }
  for (const r of withTrust) {
    const dateStr = r.created_at ? r.created_at.slice(0, 10) : "";
    if (dateStr && countByDate.has(dateStr)) {
      countByDate.set(dateStr, (countByDate.get(dateStr) ?? 0) + 1);
    }
  }
  const recentReviewTrend = dayKeys.map((date) => ({
    date,
    count: countByDate.get(date) ?? 0,
  }));

  return {
    totalReviews,
    averageRating,
    verifiedRatio,
    ratingDistribution,
    topHelpfulReviews,
    topRecommendedReviews,
    recentReviewTrend,
    trustScoreDistribution,
  };
}
