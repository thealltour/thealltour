/**
 * PR25: 작성자별 리뷰 그룹핑 및 프로필 계산.
 */
import { getReviewAuthorKey, getReviewAuthorDisplayName } from "@/lib/reviewAuthorIdentity";
import { analyzeAuthorPattern } from "@/lib/reviewAuthorPatternAnalysis";
import { calculateAuthorTrustScore } from "@/lib/reviewAuthorTrustScore";
import { normalizeReviewContent, isWithinLastDays } from "@/lib/reviewAnomalyDetection";
import type {
  ReviewAuthorProfile,
  ReviewAuthorPatternAnalysis,
  AuthorRiskLevel,
} from "@/types/reviewAuthorProfile";

export type ReviewForProfile = {
  id: string;
  content?: string | null;
  title?: string | null;
  rating?: number | null;
  created_at?: string | null;
  eligibility_id?: string | null;
  helpfulCount?: number;
  trustScore?: number;
  status?: string;
  report_count?: number;
  reportCount?: number;
  member_id?: string | null;
  author_name?: string | null;
};

/**
 * authorKey 기준으로 리뷰 그룹핑.
 */
export function groupReviewsByAuthor(
  reviews: ReviewForProfile[],
): Map<string, ReviewForProfile[]> {
  const map = new Map<string, ReviewForProfile[]>();
  for (const r of reviews) {
    const key = getReviewAuthorKey(r);
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return map;
}

const RECENT_DAYS = 30;
const MIN_REVIEWS_FOR_RISK = 2;

function getAuthorRiskLevel(
  authorTrustScore: number,
  pattern: ReviewAuthorPatternAnalysis,
  totalReviews: number,
): AuthorRiskLevel {
  if (totalReviews < MIN_REVIEWS_FOR_RISK) return "low";
  if (authorTrustScore < 40) return "high";
  if (authorTrustScore < 60) return "medium";
  if (
    pattern.hasExtremeBias ||
    pattern.hasDuplicatePattern ||
    pattern.hasLowTrustPattern
  ) {
    if (authorTrustScore < 55) return "high";
    return "medium";
  }
  return "low";
}

/**
 * 단일 작성자 리뷰 그룹으로 ReviewAuthorProfile 생성.
 */
export function buildSingleAuthorProfile(
  authorKey: string,
  authorReviews: ReviewForProfile[],
  displayName?: string,
): ReviewAuthorProfile {
  const totalReviews = authorReviews.length;
  const pattern = analyzeAuthorPattern(authorReviews, authorKey);
  const authorTrustScore = calculateAuthorTrustScore(authorReviews, pattern);
  const authorRiskLevel = getAuthorRiskLevel(authorTrustScore, pattern, totalReviews);

  const ratings = authorReviews
    .map((r) => r.rating)
    .filter((r): r is number => typeof r === "number" && r >= 1 && r <= 5);
  const averageRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
      : 0;
  const verifiedReviewCount = authorReviews.filter((r) => !!r.eligibility_id).length;
  const unverifiedReviewCount = totalReviews - verifiedReviewCount;
  const helpfulReceivedTotal = authorReviews.reduce((s, r) => s + (r.helpfulCount ?? 0), 0);
  const lengths = authorReviews.map((r) => ((r.content ?? "").trim().length ?? 0) + ((r.title ?? "").trim().length ?? 0));
  const averageReviewLength =
    lengths.length > 0
      ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
      : 0;
  const extremeRatingCount = ratings.filter((r) => r === 1 || r === 5).length;
  const extremeRatingRatio =
    ratings.length > 0 ? Math.round((extremeRatingCount / ratings.length) * 1000) / 1000 : 0;

  const normCount = new Map<string, number>();
  for (const r of authorReviews) {
    const n = normalizeReviewContent(r.content ?? undefined);
    if (n.length >= 10) normCount.set(n, (normCount.get(n) ?? 0) + 1);
  }
  let duplicateLike = 0;
  for (const r of authorReviews) {
    const n = normalizeReviewContent(r.content ?? undefined);
    if (n.length >= 10 && (normCount.get(n) ?? 0) >= 2) duplicateLike++;
  }
  const duplicateContentRatio =
    totalReviews > 0 ? Math.round((duplicateLike / totalReviews) * 1000) / 1000 : 0;

  const withTrust = authorReviews.filter((r) => typeof r.trustScore === "number");
  const lowTrustCount = withTrust.filter((r) => (r.trustScore ?? 100) < 40).length;
  const lowTrustReviewRatio =
    withTrust.length > 0 ? Math.round((lowTrustCount / withTrust.length) * 1000) / 1000 : 0;

  const flaggedStatuses = ["flagged", "hidden", "under_review"];
  const reportCount = authorReviews.reduce((s, r) => s + (r.report_count ?? r.reportCount ?? 0), 0);
  const flaggedCount = authorReviews.filter(
    (r) => flaggedStatuses.includes(String(r.status ?? "")) || (r.report_count ?? r.reportCount ?? 0) > 0,
  ).length;
  const flaggedReviewRatio =
    totalReviews > 0 ? Math.round((flaggedCount / totalReviews) * 1000) / 1000 : 0;

  const recentReviewCount = authorReviews.filter((r) =>
    isWithinLastDays(r.created_at ?? undefined, RECENT_DAYS),
  ).length;

  return {
    authorKey,
    displayName: displayName ?? undefined,
    totalReviews,
    averageRating,
    verifiedReviewCount,
    unverifiedReviewCount,
    helpfulReceivedTotal,
    averageReviewLength,
    extremeRatingRatio,
    duplicateContentRatio,
    lowTrustReviewRatio,
    flaggedReviewRatio,
    recentReviewCount,
    authorTrustScore,
    authorRiskLevel,
    patternSignals: pattern.signals,
  };
}

/**
 * 전체 리뷰에서 작성자별 프로필 배열 생성. high risk 우선 정렬.
 */
export function buildReviewAuthorProfiles(
  reviews: ReviewForProfile[],
  options?: { sortByRiskFirst?: boolean },
): ReviewAuthorProfile[] {
  const byAuthor = groupReviewsByAuthor(reviews);
  const profiles: ReviewAuthorProfile[] = [];
  for (const [authorKey, list] of byAuthor) {
    const displayName = list.length > 0 ? getReviewAuthorDisplayName(list[0]) : undefined;
    profiles.push(buildSingleAuthorProfile(authorKey, list, displayName));
  }
  const sortByRiskFirst = options?.sortByRiskFirst !== false;
  profiles.sort((a, b) => {
    if (sortByRiskFirst) {
      const order = { high: 0, medium: 1, low: 2 };
      const oa = order[a.authorRiskLevel];
      const ob = order[b.authorRiskLevel];
      if (oa !== ob) return oa - ob;
    }
    if (a.authorTrustScore !== b.authorTrustScore) return a.authorTrustScore - b.authorTrustScore;
    return b.totalReviews - a.totalReviews;
  });
  return profiles;
}
