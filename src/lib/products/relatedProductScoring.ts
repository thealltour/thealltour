import type { Product } from "@/types/product";
import { parseThemeTokens } from "@/lib/productTaxonomies";

/** PR35: 관련도 점수 가중치. 관련도 우선 정렬용 */
const SCORE = {
  /** 같은 지역(destination_id) 일치 */
  DESTINATION: 5,
  /** 같은 테마 1개 이상 공유 */
  THEME: 3,
  /** 같은 카테고리 */
  CATEGORY: 2,
  /** 같은 상품 라인 */
  PRODUCT_LINE: 2,
  /** 인기 상품 플래그 */
  POPULAR: 1,
  /** 추천 상품 플래그 */
  RECOMMEND: 1,
  /** 최신 상품 가산점 (기준일 기준 180일 이내) */
  RECENCY_DAYS: 180,
  RECENCY: 0.5,
} as const;

/**
 * PR35: 현재 상품과 후보 상품 간 관련도 점수 계산.
 * 지역 > 테마 > 카테고리/상품라인 > 인기·추천·최신 순.
 */
export function scoreRelatedProduct(
  current: Product,
  candidate: Product,
  refDate: Date = new Date(),
): number {
  let score = 0;

  const currentDest = current.destination_id?.trim() || "";
  const candidateDest = candidate.destination_id?.trim() || "";
  if (currentDest && currentDest === candidateDest) {
    score += SCORE.DESTINATION;
  }

  const currentThemes = new Set(
    parseThemeTokens(current.theme).map((t) => t.toLowerCase()),
  );
  const candidateThemes = parseThemeTokens(candidate.theme).map((t) =>
    t.toLowerCase(),
  );
  if (
    currentThemes.size > 0 &&
    candidateThemes.some((t) => currentThemes.has(t))
  ) {
    score += SCORE.THEME;
  }

  const currentCategory = (current.category ?? "").trim().toLowerCase();
  const candidateCategory = (candidate.category ?? "").trim().toLowerCase();
  if (currentCategory && currentCategory === candidateCategory) {
    score += SCORE.CATEGORY;
  }

  const currentLine = current.product_line_id?.trim() || "";
  const candidateLine = candidate.product_line_id?.trim() || "";
  if (currentLine && currentLine === candidateLine) {
    score += SCORE.PRODUCT_LINE;
  }

  if (candidate.is_popular) score += SCORE.POPULAR;
  if (candidate.is_recommend) score += SCORE.RECOMMEND;

  if (candidate.created_at) {
    try {
      const created = new Date(candidate.created_at);
      const days = (refDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      if (days >= 0 && days <= SCORE.RECENCY_DAYS) {
        score += SCORE.RECENCY;
      }
    } catch {
      // ignore invalid date
    }
  }

  return score;
}

/**
 * PR35: 현재 상품 제외 후 관련도 점수 기준 내림차순 정렬.
 * 동점일 경우 created_at 최신 우선으로 안정 정렬.
 */
export function sortRelatedProducts(
  current: Product,
  candidates: Product[],
  refDate?: Date,
): Product[] {
  const currentId = current.id?.trim();
  const filtered = candidates.filter((p) => p.id?.trim() !== currentId);
  const date = refDate ?? new Date();

  return [...filtered].sort((a, b) => {
    const scoreA = scoreRelatedProduct(current, a, date);
    const scoreB = scoreRelatedProduct(current, b, date);
    if (scoreB !== scoreA) return scoreB - scoreA;
    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return createdB - createdA;
  });
}

/** 관련도 점수가 이 값 미만이면 추천에서 제외 (품질 필터) */
export const MIN_RELATED_SCORE = 0.5;
