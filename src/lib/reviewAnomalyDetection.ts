/**
 * PR17: 리뷰 이상 감지 유틸.
 * - 평점 급락 상품, 리뷰 급증 상품, 스팸/어뷰징 의심 리뷰, 운영 알림 목록.
 * - PR21: Trust Score 보조 지표 연동.
 */
import type {
  RatingDropProduct,
  ReviewSurgeProduct,
  SuspiciousReviewItem,
  ReviewAnomalyAlert,
  ReviewAnomalyResult,
} from "@/types/reviewAnomalies";
import { calculateReviewTrustScore } from "@/lib/reviewTrustScore";

/** 이상 감지에 사용하는 최소 리뷰 필드 (PublicReviewItem 호환) */
export type ReviewForAnomaly = {
  id: string;
  product_id?: string | null;
  rating?: number;
  helpfulCount?: number;
  eligibility_id?: string;
  created_at?: string;
  content?: string;
};

/** product_id 기준 그룹핑 (product_id 없는 리뷰는 제외) */
export function groupReviewsByProduct(
  reviews: ReviewForAnomaly[],
): Map<string, ReviewForAnomaly[]> {
  const map = new Map<string, ReviewForAnomaly[]>();
  for (const r of reviews) {
    const pid = r.product_id?.trim();
    if (!pid) continue;
    const list = map.get(pid) ?? [];
    list.push(r);
    map.set(pid, list);
  }
  return map;
}

/** dateString이 오늘 기준 최근 days일 이내인지 */
export function isWithinLastDays(dateString: string | undefined, days: number): boolean {
  if (!dateString) return false;
  const d = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  return diffDays >= 0 && diffDays <= days;
}

/** dateString이 오늘 기준 (daysEnd, daysStart] 구간인지 (과거일수) */
function isBetweenDays(
  dateString: string | undefined,
  daysStart: number,
  daysEnd: number,
): boolean {
  if (!dateString) return false;
  const d = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  return diffDays > daysStart && diffDays <= daysEnd;
}

/** 리뷰 배열의 평균 평점 (유효 rating만) */
export function getAverageRating(reviews: ReviewForAnomaly[]): number {
  const ratings = reviews
    .map((r) => r.rating)
    .filter((r): r is number => typeof r === "number" && r >= 1 && r <= 5);
  if (ratings.length === 0) return 0;
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100;
}

/** 비교용 정규화 문자열: trim, 소문자, 연속 공백 1칸, 특수문자 제거 */
export function normalizeReviewContent(content: string | undefined): string {
  if (!content || typeof content !== "string") return "";
  return content
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣa-z0-9]/g, "")
    .trim();
}

/** 미리보기 문자열 (maxLength 기본 80) */
export function getContentPreview(content: string | undefined, maxLength = 80): string {
  if (!content || typeof content !== "string") return "";
  const s = content.trim();
  if (s.length <= maxLength) return s;
  return s.slice(0, maxLength) + "…";
}

const MIN_RECENT = 3;
const MIN_PREVIOUS = 3;
const RATING_DROP_THRESHOLD = -1.0;

/**
 * 평점 급락 상품 탐지.
 * 최근 14일 vs 이전 30일(15~44일) 평균 평점 비교.
 */
export function detectRatingDropProducts(
  reviews: ReviewForAnomaly[],
): RatingDropProduct[] {
  const byProduct = groupReviewsByProduct(reviews);
  const result: RatingDropProduct[] = [];

  for (const [productId, list] of byProduct) {
    const recent = list.filter((r) => isWithinLastDays(r.created_at, 14));
    const previous = list.filter((r) => isBetweenDays(r.created_at, 14, 44));

    if (recent.length < MIN_RECENT || previous.length < MIN_PREVIOUS) continue;

    const recentAvg = getAverageRating(recent);
    const previousAvg = getAverageRating(previous);
    const delta = Math.round((recentAvg - previousAvg) * 100) / 100;

    if (delta > RATING_DROP_THRESHOLD) continue;

    result.push({
      productId,
      previousAverageRating: previousAvg,
      recentAverageRating: recentAvg,
      ratingDelta: delta,
      previousCount: previous.length,
      recentCount: recent.length,
    });
  }

  result.sort((a, b) => (a.ratingDelta < b.ratingDelta ? -1 : 1));
  return result;
}

const SURGE_MIN_RECENT = 5;
const SURGE_MIN_PREVIOUS = 3;
const SURGE_RATIO_THRESHOLD = 2;

/**
 * 최근 리뷰 급증 상품 탐지.
 * 최근 7일 vs 이전 30일(8~37일) 일평균 비교.
 */
export function detectReviewSurgeProducts(
  reviews: ReviewForAnomaly[],
): ReviewSurgeProduct[] {
  const byProduct = groupReviewsByProduct(reviews);
  const result: ReviewSurgeProduct[] = [];

  for (const [productId, list] of byProduct) {
    const recent7 = list.filter((r) => isWithinLastDays(r.created_at, 7));
    const previous30 = list.filter((r) => isBetweenDays(r.created_at, 7, 37));

    if (recent7.length < SURGE_MIN_RECENT || previous30.length < SURGE_MIN_PREVIOUS) continue;

    const recent7dPerDay = recent7.length / 7;
    const previous30dPerDay = previous30.length / 30;
    if (previous30dPerDay <= 0) continue;

    const surgeRatio = Math.round((recent7dPerDay / previous30dPerDay) * 100) / 100;
    if (surgeRatio < SURGE_RATIO_THRESHOLD) continue;

    result.push({
      productId,
      recent7dCount: recent7.length,
      previous30dCount: previous30.length,
      recent7dPerDay: Math.round(recent7dPerDay * 100) / 100,
      previous30dPerDay: Math.round(previous30dPerDay * 100) / 100,
      surgeRatio,
    });
  }

  result.sort((a, b) => b.surgeRatio - a.surgeRatio);
  return result;
}

/** 리뷰 생성 후 경과 일수 */
function getDaysSinceCreated(createdAt: string | undefined): number {
  if (!createdAt) return 999;
  const d = new Date(createdAt);
  const now = new Date();
  return (now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000);
}

/**
 * 스팸/어뷰징 의심 리뷰 탐지 및 riskScore 계산.
 * PR21: trustScore < 40 → 의심 후보, trustScore < 20 → 고위험 보조 지표로 반영.
 * PR25: authorSignals 있으면 reasons에 추가 (작성자 패턴 기반).
 */
export function calculateSuspiciousRiskScore(
  review: ReviewForAnomaly,
  context: {
    sameProductNormalizedContents: Map<string, number>;
    hasDuplicateContent: boolean;
    /** PR21: Trust Score (0~100). 있으면 보조 지표로 사용 */
    trustScore?: number;
    /** PR25: 작성자 패턴/신뢰도 기반 사유. 있으면 reasons에 추가 */
    authorSignals?: string[];
  },
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const content = (review.content ?? "").trim();
  const contentLen = content.length;
  const rating = review.rating ?? 0;
  const verified = !!review.eligibility_id;
  const helpfulCount = review.helpfulCount ?? 0;
  const daysSince = getDaysSinceCreated(review.created_at);

  // A. 극단 평점 + 매우 짧은 본문
  if ((rating === 1 || rating === 5) && contentLen < 15) {
    score += 2;
    reasons.push("극단 평점 + 짧은 본문");
  }

  // B. helpfulCount 비정상: 20 이상이면서 생성 3일 이하 또는 리뷰 길이에 비해 과도
  if (helpfulCount >= 20) {
    if (daysSince <= 3) {
      score += 3;
      reasons.push("짧은 기간 내 도움됨 급증");
    } else if (contentLen < 50 && helpfulCount > contentLen * 2) {
      score += 2;
      reasons.push("본문 대비 과도한 도움됨");
    }
  }

  // C. 반복 패턴
  if (context.hasDuplicateContent) {
    score += 3;
    reasons.push("동일 상품 내 유사/반복 문구");
  }

  // D. 비인증 극단 리뷰
  if (!verified && (rating === 1 || rating === 5) && contentLen < 80) {
    score += 2;
    reasons.push("비인증 극단 리뷰");
  }

  // PR21: Trust Score 보조 지표 (moderation 강제 변경 없음)
  const ts = context.trustScore;
  if (ts != null) {
    if (ts < 20) {
      score += 2;
      reasons.push("Trust Score 고위험");
    } else if (ts < 40) {
      score += 1;
      reasons.push("Trust Score 의심 후보");
    }
  }

  // PR25: 작성자 패턴 신호
  if (context.authorSignals?.length) {
    for (const msg of context.authorSignals) {
      reasons.push(msg);
      score += 1;
    }
  }

  return { score, reasons };
}

/**
 * 스팸/어뷰징 의심 리뷰 탐지.
 */
export function detectSuspiciousReviews(
  reviews: ReviewForAnomaly[],
): SuspiciousReviewItem[] {
  const byProduct = groupReviewsByProduct(reviews);
  const normalizedCountByContent = new Map<string, number>();

  for (const [, list] of byProduct) {
    const seen = new Map<string, number>();
    for (const r of list) {
      const norm = normalizeReviewContent(r.content);
      if (norm.length < 10) continue;
      seen.set(norm, (seen.get(norm) ?? 0) + 1);
    }
    for (const [norm, count] of seen) {
      if (count >= 2) {
        normalizedCountByContent.set(norm, (normalizedCountByContent.get(norm) ?? 0) + count);
      }
    }
  }

  const result: SuspiciousReviewItem[] = [];

  for (const r of reviews) {
    const pid = r.product_id?.trim();
    if (!pid) continue;

    const norm = normalizeReviewContent(r.content);
    const hasDuplicate =
      norm.length >= 10 && (normalizedCountByContent.get(norm) ?? 0) >= 2;

    const productList = byProduct.get(pid) ?? [];
    const sameProductNormCount = productList.filter(
      (x) => normalizeReviewContent(x.content) === norm && norm.length >= 10,
    ).length;
    const sameProductNormalizedContents = new Map<string, number>();
    for (const x of productList) {
      const n = normalizeReviewContent(x.content);
      if (n.length >= 10) sameProductNormalizedContents.set(n, (sameProductNormalizedContents.get(n) ?? 0) + 1);
    }

    const trust = calculateReviewTrustScore(r, {
      duplicateContentInProduct: sameProductNormCount >= 2,
    });

    const { score, reasons } = calculateSuspiciousRiskScore(r, {
      sameProductNormalizedContents,
      hasDuplicateContent: sameProductNormCount >= 2,
      trustScore: trust.trustScore,
    });

    if (score === 0) continue;

    result.push({
      id: r.id,
      productId: pid,
      rating: r.rating ?? 0,
      helpfulCount: r.helpfulCount ?? 0,
      verified: !!r.eligibility_id,
      createdAt: r.created_at ?? "",
      contentPreview: getContentPreview(r.content, 80),
      reasons,
      riskScore: score,
    });
  }

  result.sort((a, b) => {
    if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  });
  return result;
}

/**
 * 탐지 결과를 운영 알림 목록으로 변환.
 */
export function buildReviewAnomalyAlerts(
  anomalies: {
    ratingDropProducts: RatingDropProduct[];
    surgeProducts: ReviewSurgeProduct[];
    suspiciousReviews: SuspiciousReviewItem[];
  },
): ReviewAnomalyAlert[] {
  const alerts: ReviewAnomalyAlert[] = [];

  for (const p of anomalies.ratingDropProducts) {
    const severity: "high" | "medium" | "low" =
      p.ratingDelta <= -1.5 ? "high" : p.ratingDelta <= -1 ? "medium" : "low";
    alerts.push({
      type: "rating_drop",
      severity,
      title: `평점 급락: ${p.productId}`,
      description: `최근 14일 평균 ${p.recentAverageRating} (이전 30일 ${p.previousAverageRating}), Δ ${p.ratingDelta}`,
      productId: p.productId,
      createdAt: undefined,
    });
  }

  for (const p of anomalies.surgeProducts) {
    const severity: "high" | "medium" | "low" =
      p.surgeRatio >= 3 ? "high" : p.surgeRatio >= 2 ? "medium" : "low";
    alerts.push({
      type: "review_surge",
      severity,
      title: `리뷰 급증: ${p.productId}`,
      description: `최근 7일 ${p.recent7dCount}건 (일평균 ${p.recent7dPerDay}), 이전 대비 ${p.surgeRatio}배`,
      productId: p.productId,
      createdAt: undefined,
    });
  }

  for (const r of anomalies.suspiciousReviews) {
    const severity: "high" | "medium" | "low" =
      r.riskScore >= 5 ? "high" : r.riskScore >= 3 ? "medium" : "low";
    alerts.push({
      type: "suspicious_review",
      severity,
      title: `의심 리뷰: ${r.id}`,
      description: r.reasons.join(", ") + " — " + r.contentPreview.slice(0, 50),
      productId: r.productId,
      reviewId: r.id,
      createdAt: r.createdAt,
    });
  }

  alerts.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
  });
  return alerts;
}

/**
 * 전체 이상 감지 실행 및 결과 반환.
 */
export function detectReviewAnomalies(reviews: ReviewForAnomaly[]): ReviewAnomalyResult {
  const ratingDropProducts = detectRatingDropProducts(reviews);
  const surgeProducts = detectReviewSurgeProducts(reviews);
  const suspiciousReviews = detectSuspiciousReviews(reviews);
  const alerts = buildReviewAnomalyAlerts({
    ratingDropProducts,
    surgeProducts,
    suspiciousReviews,
  });

  return {
    ratingDropProducts,
    surgeProducts,
    suspiciousReviews,
    alerts,
    summary: {
      totalAlerts: alerts.length,
      ratingDropCount: ratingDropProducts.length,
      surgeCount: surgeProducts.length,
      suspiciousReviewCount: suspiciousReviews.length,
    },
  };
}
