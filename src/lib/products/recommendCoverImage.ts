/**
 * 대표 이미지(cover) 추천 후보를 반환합니다.
 * URL만으로 커버를 확정할 수 없으므로 "추천+적용" UX용.
 */

export type RecommendCoverParams = {
  /** 상품 이미지 URL 목록 */
  productImages: string[];
  /** 일정에서 추출한 이미지 URL 목록 (상품 이미지가 없을 때 사용) */
  itineraryImages?: string[];
};

export type CoverCandidate = {
  url: string;
  reason: string;
};

const THUMB_PENALTY = /thumb|small|_s\.|_m\.|thumbnail/i;
const LARGE_BONUS = /large|original|w=\d{3,}|width=\d{3,}|h=\d{3,}/i;

function scoreUrl(url: string): number {
  let score = 0;
  if (THUMB_PENALTY.test(url)) score -= 2;
  if (LARGE_BONUS.test(url)) score += 1;
  return score;
}

export function recommendCoverCandidates(params: RecommendCoverParams): CoverCandidate[] {
  const { productImages, itineraryImages = [] } = params;
  const normalized = productImages.filter((u) => typeof u === "string" && u.trim().length > 0);

  if (normalized.length > 0) {
    const first = normalized[0];
    const rest = normalized.slice(1).map((url) => ({ url, score: scoreUrl(url) }));
    rest.sort((a, b) => b.score - a.score);
    const restTop = rest.slice(0, 2).map((x) => x.url);
    const candidates = [first, ...restTop].filter((u, i, arr) => arr.indexOf(u) === i);
    const reasons: string[] = [
      "첫 번째 등록 이미지",
      rest.length > 0 ? "고해상도 추정" : "추천 후보",
      "썸네일로 보이는 URL 제외 후 추천",
    ];
    return candidates.slice(0, 3).map((url, i) => ({
      url,
      reason: reasons[i] ?? "추천 후보",
    }));
  }

  const itinerary = itineraryImages.filter((u) => typeof u === "string" && u.trim().length > 0);
  if (itinerary.length > 0) {
    return itinerary.slice(0, 3).map((url, i) => ({
      url,
      reason: i === 0 ? "일정 Day1 첫 이미지" : "일정 이미지",
    }));
  }

  return [];
}
