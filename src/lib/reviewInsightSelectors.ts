/**
 * PR28: 상품 인사이트 생성 시 필요한 보조 데이터 접근 표준화.
 * 이미 로드된 데이터를 받아 상품별 map 구성. (server-only 모듈 직접 의존 없음)
 */
import type {
  RatingDropProduct,
  ReviewSurgeProduct,
  ReviewAnomalyResult,
} from "@/types/reviewAnomalies";
import type { ReviewProductConversionSummary } from "@/types/reviewConversionAnalytics";

/** 요약 구조 (reviewSummaries.ProductReviewSummary와 호환) */
export type ProductReviewSummaryLike = {
  product_id: string;
  positive_points?: string[];
  negative_points?: string[];
  recommended_for?: string[];
  summary_text?: string | null;
  average_rating?: number | null;
  review_count?: number;
};

export type ReviewForInsight = {
  id: string;
  product_id?: string | null;
  rating?: number;
  content?: string;
  content_good?: string;
  content_bad?: string;
  content_tip?: string;
  summary?: string;
  helpfulCount?: number;
  eligibility_id?: string;
  created_at?: string;
  recommendationScore?: number;
  trustScore?: number;
};

/**
 * 리뷰 배열을 product_id 기준으로 그룹핑.
 */
export function groupReviewsByProduct(
  reviews: ReviewForInsight[],
): Map<string, ReviewForInsight[]> {
  const map = new Map<string, ReviewForInsight[]>();
  for (const r of reviews) {
    const pid = r.product_id?.trim();
    if (!pid) continue;
    const list = map.get(pid) ?? [];
    list.push(r);
    map.set(pid, list);
  }
  return map;
}

/**
 * 요약 목록을 product_id -> summary map으로 변환.
 */
export function getProductReviewSummaryMap(
  summaries: ProductReviewSummaryLike[],
): Map<string, ProductReviewSummaryLike> {
  const map = new Map<string, ProductReviewSummaryLike>();
  for (const s of summaries) {
    if (s.product_id) map.set(s.product_id, s);
  }
  return map;
}

/**
 * 이상 감지 결과를 상품별 데이터로 정리.
 */
export function getProductAnomalyMap(anomalyResult: ReviewAnomalyResult | null): {
  ratingDropByProduct: Map<string, RatingDropProduct>;
  surgeByProduct: Map<string, ReviewSurgeProduct>;
  suspiciousCountByProduct: Map<string, number>;
  alertsByProduct: Map<string, { type: string; severity: string; description: string }[]>;
} {
  const ratingDropByProduct = new Map<string, RatingDropProduct>();
  const surgeByProduct = new Map<string, ReviewSurgeProduct>();
  const suspiciousCountByProduct = new Map<string, number>();
  const alertsByProduct = new Map<string, { type: string; severity: string; description: string }[]>();

  if (!anomalyResult) {
    return { ratingDropByProduct, surgeByProduct, suspiciousCountByProduct, alertsByProduct };
  }

  for (const p of anomalyResult.ratingDropProducts) {
    ratingDropByProduct.set(p.productId, p);
  }
  for (const p of anomalyResult.surgeProducts) {
    surgeByProduct.set(p.productId, p);
  }
  for (const r of anomalyResult.suspiciousReviews) {
    suspiciousCountByProduct.set(
      r.productId,
      (suspiciousCountByProduct.get(r.productId) ?? 0) + 1,
    );
  }
  for (const a of anomalyResult.alerts) {
    if (!a.productId) continue;
    const list = alertsByProduct.get(a.productId) ?? [];
    list.push({ type: a.type, severity: a.severity, description: a.description });
    alertsByProduct.set(a.productId, list);
  }
  return { ratingDropByProduct, surgeByProduct, suspiciousCountByProduct, alertsByProduct };
}

/**
 * 전환 요약을 productId -> summary map으로.
 */
export function getProductConversionMap(
  productSummaries: ReviewProductConversionSummary[],
): Map<string, ReviewProductConversionSummary> {
  const map = new Map<string, ReviewProductConversionSummary>();
  for (const s of productSummaries) {
    map.set(s.productId, s);
  }
  return map;
}

/**
 * 검토 대상 리뷰 목록에서 상품별 flagged/under_review 수 집계.
 */
export function getProductModerationMap(
  moderationReviews: Array<{ product_id?: string | null; status?: string; report_count?: number }>,
): Map<string, { flaggedCount: number; underReviewCount: number }> {
  const map = new Map<string, { flaggedCount: number; underReviewCount: number }>();
  for (const r of moderationReviews) {
    const pid = r.product_id?.trim();
    if (!pid) continue;
    const cur = map.get(pid) ?? { flaggedCount: 0, underReviewCount: 0 };
    if (r.status === "flagged") cur.flaggedCount += 1;
    if (r.status !== "submitted" || (r.report_count ?? 0) > 0) cur.underReviewCount += 1;
    map.set(pid, cur);
  }
  return map;
}

/**
 * 상품별 trust 집계: 리뷰 배열에 trustScore가 있으면 low(0~39) 비율 등 계산.
 */
export function getProductTrustAggregates(
  reviewsByProduct: Map<string, ReviewForInsight[]>,
): Map<string, { lowTrustRatio: number; avgTrust: number; totalReviews: number }> {
  const result = new Map<
    string,
    { lowTrustRatio: number; avgTrust: number; totalReviews: number }
  >();
  for (const [productId, list] of reviewsByProduct) {
    const withTrust = list.filter((r) => typeof (r as ReviewForInsight & { trustScore?: number }).trustScore === "number");
    const total = withTrust.length;
    const lowCount = withTrust.filter((r) => (r as ReviewForInsight & { trustScore: number }).trustScore < 40).length;
    const sum = withTrust.reduce((s, r) => s + (r as ReviewForInsight & { trustScore: number }).trustScore, 0);
    result.set(productId, {
      lowTrustRatio: total > 0 ? lowCount / total : 0,
      avgTrust: total > 0 ? sum / total : 0,
      totalReviews: list.length,
    });
  }
  return result;
}
