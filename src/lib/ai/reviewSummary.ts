/**
 * PR14: 상품별 리뷰 요약 생성.
 * - 1차: rule-based fallback (LLM 없이 동작).
 * - 추후: generateWithLLM() 교체로 OpenAI 등 연동 가능하도록 인터페이스 유지.
 */
import "server-only";

import { getProductByIdFresh } from "@/lib/products";
import {
  getSummarySourceReviews,
  type UpsertProductReviewSummaryPayload,
} from "@/lib/reviewSummaries";
import type { PublicReviewItem } from "@/types/review";

const MIN_REVIEWS_FOR_SUMMARY = 2;

export type GenerateProductReviewSummaryResult = {
  summaryText: string;
  positivePoints: string[];
  negativePoints: string[];
  recommendedFor: string[];
  reviewCount: number;
  averageRating: number;
  sourceReviewIds: string[];
};

/**
 * 리뷰 목록 + 상품명으로 요약 생성 (rule-based).
 * - 긍정 포인트: content_good에서 빈도 높은 문구/키워드 스타일 추출 (간단히 문장 단위).
 * - 아쉬운 포인트: content_bad 동일.
 * - 추천 대상: content_tip 또는 고정 문구 1~3개.
 * - summaryText: 평점·리뷰 수 기반 2~4문장.
 */
function generateFromReviews(
  productTitle: string,
  reviews: PublicReviewItem[],
): GenerateProductReviewSummaryResult {
  const reviewCount = reviews.length;
  const ratings = reviews.map((r) => r.rating).filter((r): r is number => typeof r === "number" && r >= 1 && r <= 5);
  const averageRating = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : 0;

  const goodLines = reviews
    .map((r) => r.content_good?.trim())
    .filter((s): s is string => !!s && s.length > 0);
  const badLines = reviews
    .map((r) => r.content_bad?.trim())
    .filter((s): s is string => !!s && s.length > 0);
  const tipLines = reviews
    .map((r) => r.content_tip?.trim())
    .filter((s): s is string => !!s && s.length > 0);

  const takeUnique = (lines: string[], max: number): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const line of lines) {
      const normalized = line.slice(0, 80).trim();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        out.push(normalized);
        if (out.length >= max) break;
      }
    }
    return out;
  };

  const positivePoints = takeUnique(goodLines, 4);
  const negativePoints = takeUnique(badLines, 3);
  const recommendedFor = takeUnique(tipLines, 3);
  if (recommendedFor.length === 0) {
    recommendedFor.push("여행 후기를 참고해 보시면 좋습니다.");
  }

  let summaryText = "";
  if (reviewCount < MIN_REVIEWS_FOR_SUMMARY) {
    summaryText = "아직 리뷰가 적어 요약을 만들 수 없습니다.";
  } else {
    const parts: string[] = [];
    if (averageRating >= 4) {
      parts.push(`전반적으로 ${productTitle}에 대한 만족도가 높은 편입니다.`);
    } else if (averageRating >= 3) {
      parts.push(`전반적으로 ${productTitle}에 대한 평가는 보통 이상입니다.`);
    } else {
      parts.push(`일부 리뷰에서 개선이 필요한 부분이 언급되었습니다.`);
    }
    if (goodLines.length > 0) {
      parts.push("가이드 친절도, 일정 구성, 숙소 등에서 긍정적인 의견이 많았습니다.");
    }
    if (badLines.length > 0) {
      parts.push("다만 식사 구성, 이동 시간 등에서 아쉬운 점을 남긴 리뷰도 있습니다.");
    }
    if (parts.length === 0) {
      parts.push(`리뷰 ${reviewCount}건을 바탕으로 요약한 내용입니다.`);
    }
    summaryText = parts.join(" ");
  }

  return {
    summaryText,
    positivePoints,
    negativePoints,
    recommendedFor,
    reviewCount,
    averageRating,
    sourceReviewIds: reviews.map((r) => r.id),
  };
}

/**
 * 상품 ID 기준으로 소스 리뷰 수집 후 요약 생성.
 * - 리뷰 2건 미만이면 null 반환 (생략).
 * - 상품 없으면 null.
 */
export async function generateProductReviewSummary(
  productId: string,
): Promise<GenerateProductReviewSummaryResult | null> {
  const [product, reviews] = await Promise.all([
    getProductByIdFresh(productId),
    getSummarySourceReviews(productId, { limit: 200 }),
  ]);

  if (!product) return null;
  if (reviews.length < MIN_REVIEWS_FOR_SUMMARY) return null;

  const productTitle = product.title?.trim() || "이 상품";
  return generateFromReviews(productTitle, reviews);
}

/**
 * 요약 생성 후 upsert용 payload 반환.
 * 실패 시 status='failed'로 저장할 수 있도록 호출 측에서 처리.
 */
export async function generateAndBuildPayload(
  productId: string,
): Promise<{ payload: UpsertProductReviewSummaryPayload; success: true } | { success: false; reason: string }> {
  try {
    const result = await generateProductReviewSummary(productId);
    if (!result) {
      return { success: false, reason: "리뷰가 부족하거나 상품 정보를 찾을 수 없습니다." };
    }
    const payload: UpsertProductReviewSummaryPayload = {
      review_count: result.reviewCount,
      average_rating: result.averageRating,
      summary_text: result.summaryText,
      positive_points: result.positivePoints,
      negative_points: result.negativePoints,
      recommended_for: result.recommendedFor,
      source_review_ids: result.sourceReviewIds,
      status: "ready",
    };
    return { payload, success: true };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "요약 생성 중 오류가 발생했습니다.";
    return { success: false, reason };
  }
}
