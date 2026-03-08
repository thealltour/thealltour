/**
 * PR25: 작성자별 반복·극단·버스트·저품질·저신뢰 패턴 분석.
 */
import { getReviewAuthorKey } from "@/lib/reviewAuthorIdentity";
import { normalizeReviewContent, isWithinLastDays } from "@/lib/reviewAnomalyDetection";
import type { ReviewAuthorPatternAnalysis } from "@/types/reviewAuthorProfile";

export type ReviewForPattern = {
  id: string;
  content?: string | null;
  rating?: number | null;
  created_at?: string | null;
  eligibility_id?: string | null;
  helpfulCount?: number;
  trustScore?: number;
  status?: string;
  report_count?: number;
  member_id?: string | null;
  author_name?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
};

const EXTREME_BIAS_MIN_REVIEWS = 5;
const EXTREME_BIAS_RATIO = 0.8;
const DUPLICATE_RATIO_THRESHOLD = 0.4;
const BURST_3_DAYS_MIN = 3;
const BURST_7_DAYS_MIN = 5;
const LOW_QUALITY_LENGTH = 20;
const LOW_QUALITY_SHORT_RATIO = 0.5;
const LOW_TRUST_THRESHOLD = 40;
const LOW_TRUST_RATIO = 0.5;

/**
 * 극단 평점(1 또는 5) 편향 탐지.
 */
export function detectExtremeRatingBias(
  authorReviews: ReviewForPattern[],
): { hasBias: boolean; signal?: string } {
  if (authorReviews.length < EXTREME_BIAS_MIN_REVIEWS) return { hasBias: false };
  const ratings = authorReviews
    .map((r) => r.rating)
    .filter((r): r is number => typeof r === "number" && r >= 1 && r <= 5);
  if (ratings.length < EXTREME_BIAS_MIN_REVIEWS) return { hasBias: false };
  const extremeCount = ratings.filter((r) => r === 1 || r === 5).length;
  const ratio = extremeCount / ratings.length;
  if (ratio >= EXTREME_BIAS_RATIO) {
    return { hasBias: true, signal: "극단 평점(1/5점) 비율이 높습니다." };
  }
  return { hasBias: false };
}

/**
 * 동일/유사 본문 반복률로 중복 패턴 탐지.
 */
export function detectDuplicateContentPattern(
  authorReviews: ReviewForPattern[],
): { hasDuplicate: boolean; ratio: number; signal?: string } {
  if (authorReviews.length < 2) return { hasDuplicate: false, ratio: 0 };
  const normalizedCount = new Map<string, number>();
  for (const r of authorReviews) {
    const n = normalizeReviewContent(r.content ?? undefined);
    if (n.length < 10) continue;
    normalizedCount.set(n, (normalizedCount.get(n) ?? 0) + 1);
  }
  let duplicateLike = 0;
  let totalWithContent = 0;
  for (const r of authorReviews) {
    const n = normalizeReviewContent(r.content ?? undefined);
    if (n.length < 10) continue;
    totalWithContent++;
    if ((normalizedCount.get(n) ?? 0) >= 2) duplicateLike++;
  }
  const ratio = totalWithContent > 0 ? duplicateLike / totalWithContent : 0;
  if (ratio >= DUPLICATE_RATIO_THRESHOLD) {
    return {
      hasDuplicate: true,
      ratio,
      signal: "유사/반복 문구 비율이 높습니다.",
    };
  }
  return { hasDuplicate: false, ratio };
}

/**
 * 짧은 기간 내 다수 리뷰 버스트 패턴 탐지.
 */
export function detectReviewBurstPattern(
  authorReviews: ReviewForPattern[],
): { hasBurst: boolean; signal?: string } {
  if (authorReviews.length < BURST_3_DAYS_MIN) return { hasBurst: false };
  const in3 = authorReviews.filter((r) => isWithinLastDays(r.created_at ?? undefined, 3));
  const in7 = authorReviews.filter((r) => isWithinLastDays(r.created_at ?? undefined, 7));
  if (in3.length >= BURST_3_DAYS_MIN) {
    return { hasBurst: true, signal: "최근 3일 내 다수 리뷰 작성." };
  }
  if (in7.length >= BURST_7_DAYS_MIN) {
    return { hasBurst: true, signal: "최근 7일 내 리뷰 집중 작성." };
  }
  return { hasBurst: false };
}

/**
 * 짧은/의미 빈약한 리뷰 반복 패턴.
 */
export function detectLowQualityPattern(
  authorReviews: ReviewForPattern[],
): { hasLowQuality: boolean; signal?: string } {
  if (authorReviews.length < 2) return { hasLowQuality: false };
  const withContent = authorReviews.filter((r) => (r.content ?? "").trim().length > 0);
  if (withContent.length === 0) return { hasLowQuality: false };
  const shortCount = withContent.filter(
    (r) => (r.content ?? "").trim().length < LOW_QUALITY_LENGTH,
  ).length;
  const ratio = shortCount / withContent.length;
  if (ratio >= LOW_QUALITY_SHORT_RATIO) {
    return { hasLowQuality: true, signal: "짧은 리뷰 비율이 높습니다." };
  }
  return { hasLowQuality: false };
}

/**
 * 작성자 리뷰 중 trustScore 낮은 비율.
 */
export function detectLowTrustPattern(
  authorReviews: ReviewForPattern[],
): { hasLowTrust: boolean; ratio: number; signal?: string } {
  if (authorReviews.length < 2) return { hasLowTrust: false, ratio: 0 };
  const withTrust = authorReviews.filter((r) => typeof r.trustScore === "number");
  if (withTrust.length === 0) return { hasLowTrust: false, ratio: 0 };
  const lowCount = withTrust.filter((r) => (r.trustScore ?? 100) < LOW_TRUST_THRESHOLD).length;
  const ratio = lowCount / withTrust.length;
  if (ratio >= LOW_TRUST_RATIO) {
    return { hasLowTrust: true, ratio, signal: "저신뢰 리뷰 비율이 높습니다." };
  }
  return { hasLowTrust: false, ratio };
}

/**
 * 작성자 리뷰 묶음에 대한 패턴 분석 결과 반환.
 */
export function analyzeAuthorPattern(
  authorReviews: ReviewForPattern[],
  authorKey: string,
): ReviewAuthorPatternAnalysis {
  const signals: string[] = [];
  const { hasBias, signal: extremeSignal } = detectExtremeRatingBias(authorReviews);
  if (hasBias && extremeSignal) signals.push(extremeSignal);

  const { hasDuplicate, signal: dupSignal } = detectDuplicateContentPattern(authorReviews);
  if (hasDuplicate && dupSignal) signals.push(dupSignal);

  const { hasBurst, signal: burstSignal } = detectReviewBurstPattern(authorReviews);
  if (hasBurst && burstSignal) signals.push(burstSignal);

  const { hasLowQuality, signal: lowQSignal } = detectLowQualityPattern(authorReviews);
  if (hasLowQuality && lowQSignal) signals.push(lowQSignal);

  const { hasLowTrust, signal: lowTSignal } = detectLowTrustPattern(authorReviews);
  if (hasLowTrust && lowTSignal) signals.push(lowTSignal);

  return {
    authorKey,
    hasExtremeBias: hasBias,
    hasDuplicatePattern: hasDuplicate,
    hasBurstPattern: hasBurst,
    hasLowQualityPattern: hasLowQuality,
    hasLowTrustPattern: hasLowTrust,
    signals,
  };
}
