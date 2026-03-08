/**
 * PR28: 상품별 리뷰·전환 추세 요약 문장 생성.
 * 순수 함수, UI 의존 없음.
 */
import type { ReviewForInsight } from "./reviewInsightSelectors";
import type { ReviewProductConversionSummary } from "@/types/reviewConversionAnalytics";
import type { RatingDropProduct } from "@/types/reviewAnomalies";

export interface ProductTrendSourceData {
  reviews: ReviewForInsight[];
  ratingDrop?: RatingDropProduct | null;
  conversionSummary?: ReviewProductConversionSummary | null;
  recentComplaintCount?: number;
}

/**
 * 최근 리뷰 흐름을 운영자가 빠르게 이해할 수 있는 문장으로 정리.
 */
export function buildProductTrendSummary(data: ProductTrendSourceData): string {
  const { reviews, ratingDrop, conversionSummary, recentComplaintCount } = data;
  const parts: string[] = [];

  if (reviews.length < 2) {
    return "리뷰 수가 적어 추세를 판단하기 어렵습니다.";
  }

  const recent14 = reviews.filter((r) => {
    const created = r.created_at ? new Date(r.created_at).getTime() : 0;
    const daysAgo = (Date.now() - created) / (24 * 60 * 60 * 1000);
    return daysAgo <= 14;
  });
  const older = reviews.filter((r) => {
    const created = r.created_at ? new Date(r.created_at).getTime() : 0;
    const daysAgo = (Date.now() - created) / (24 * 60 * 60 * 1000);
    return daysAgo > 14;
  });
  const avgAll =
    reviews.reduce((s, r) => s + (r.rating ?? 0), 0) /
    reviews.filter((r) => typeof r.rating === "number").length || 0;
  const avgRecent =
    recent14.length > 0
      ? recent14.reduce((s, r) => s + (r.rating ?? 0), 0) /
        recent14.filter((r) => typeof r.rating === "number").length
      : avgAll;

  if (ratingDrop && ratingDrop.ratingDelta <= -0.5) {
    parts.push(
      `최근 리뷰 수는 유지되고 있으나 평균 평점이 다소 하락하는 흐름입니다. (최근 약 ${ratingDrop.recentAverageRating}, 이전 약 ${ratingDrop.previousAverageRating})`,
    );
  } else if (recent14.length >= 3 && older.length >= 3 && avgRecent < avgAll - 0.3) {
    parts.push("최근 리뷰 평균 평점이 이전 대비 소폭 하락하는 추세입니다.");
  } else if (recent14.length >= 2 && avgRecent >= 4) {
    parts.push("최근 리뷰 평점이 양호한 편으로 유지되고 있습니다.");
  }

  if (conversionSummary && conversionSummary.reviewInteractions >= 5 && conversionSummary.attributedConversions > 0) {
    parts.push("리뷰 노출·상호작용과 전환(문의/CTA) 연결이 확인되고 있어 긍정적입니다.");
  }

  if (typeof recentComplaintCount === "number" && recentComplaintCount >= 3) {
    parts.push("리뷰 활동은 있으나 불만 키워드도 함께 늘고 있어 주의가 필요합니다.");
  }

  if (parts.length === 0) {
    return "현재 뚜렷한 추세 변화는 감지되지 않습니다. 리뷰가 더 쌓이면 추세가 보다 명확해질 수 있습니다.";
  }
  return parts.join(" ");
}
