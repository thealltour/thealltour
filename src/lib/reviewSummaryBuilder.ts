/**
 * PR18: 상품별 리뷰 요약 빌더 (규칙 기반).
 * - product_id 그룹별 구조화 요약 생성.
 * - 추후 LLM 연동 시 summarizeProductReviews만 교체 가능하도록 분리.
 */
import { groupReviewsByProduct, getAverageRating } from "@/lib/reviewAnomalyDetection";
import type { ReviewForAnomaly } from "@/lib/reviewAnomalyDetection";
import type { ProductReviewSummary, ReviewSummarySentiment } from "@/types/reviewSummaries";

/** 요약에 사용하는 최소 리뷰 필드 (PublicReviewItem / ReviewForAnomaly 호환) */
export type ReviewForSummary = Pick<
  ReviewForAnomaly,
  "product_id" | "rating" | "content" | "created_at"
>;

function isWithinLastDays(dateString: string | undefined, days: number): boolean {
  if (!dateString) return false;
  const d = new Date(dateString);
  const now = new Date();
  const diffDays = (now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000);
  return diffDays >= 0 && diffDays <= days;
}

function isBetweenDays(
  dateString: string | undefined,
  daysStart: number,
  daysEnd: number,
): boolean {
  if (!dateString) return false;
  const d = new Date(dateString);
  const now = new Date();
  const diffDays = (now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000);
  return diffDays > daysStart && diffDays <= daysEnd;
}

const STOPWORDS = new Set([
  "있다", "없다", "그리고", "그런", "이런", "저런", "합니다", "되었", "같다", "되다",
  "the", "and", "for", "with", "that", "this", "are", "was", "were", "been", "have", "has", "had",
]);

function tokenize(content: string): string[] {
  return content
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(/\s+|(?=[가-힣])|(?<=[가-힣])/)
    .map((s) => s.replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣa-z0-9]/g, ""))
    .filter((s) => s.length >= 2 && !/^\d+$/.test(s) && !STOPWORDS.has(s));
}

/**
 * 리뷰 본문에서 상위 N개 키워드 추출.
 */
export function extractTopKeywords(
  productReviews: ReviewForSummary[],
  topN = 5,
): string[] {
  const count = new Map<string, number>();
  for (const r of productReviews) {
    const text = (r.content ?? "").trim();
    if (!text) continue;
    for (const t of tokenize(text)) {
      count.set(t, (count.get(t) ?? 0) + 1);
    }
  }
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([k]) => k);
}

const PROS_PATTERNS = [
  "좋", "만족", "추천", "훌륭", "편했", "친절", "깨끗", "재밌", "알찼", "감사", "최고", "다음에",
];
const CONS_PATTERNS = [
  "아쉽", "불편", "별로", "늦", "부족", "실망", "복잡", "비쌌", "좁", "시끄", "덥", "추워", "힘들",
];

function extractByPatterns(
  productReviews: ReviewForSummary[],
  patterns: string[],
  ratingFilter: (r: number) => boolean,
): string[] {
  const candidates = new Map<string, number>();
  for (const r of productReviews) {
    const rating = r.rating ?? 0;
    if (!ratingFilter(rating)) continue;
    const text = (r.content ?? "").trim();
    if (!text) continue;
    const lower = text.toLowerCase();
    for (const p of patterns) {
      if (lower.includes(p)) {
        const idx = lower.indexOf(p);
        const snippet = text.slice(Math.max(0, idx - 2), idx + p.length + 8).trim();
        if (snippet.length >= 2) {
          const key = snippet.slice(0, 30);
          candidates.set(key, (candidates.get(key) ?? 0) + 1);
        }
      }
    }
  }
  return [...candidates.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);
}

/**
 * 장점/단점 후보 추출 (규칙 기반).
 */
export function extractProsAndCons(productReviews: ReviewForSummary[]): {
  pros: string[];
  cons: string[];
} {
  const pros = extractByPatterns(
    productReviews,
    PROS_PATTERNS,
    (r) => r >= 4 && r <= 5,
  );
  const cons = extractByPatterns(
    productReviews,
    CONS_PATTERNS,
    (r) => r >= 1 && r <= 2,
  );
  if (pros.length === 0 && productReviews.some((r) => (r.rating ?? 0) >= 4)) {
    pros.push("만족도가 높은 편입니다.");
  }
  if (cons.length === 0 && productReviews.some((r) => (r.rating ?? 0) <= 2)) {
    cons.push("일부 개선이 필요한 부분이 언급되었습니다.");
  }
  return { pros, cons };
}

const RECOMMENDED_MAP: [string[], string][] = [
  [["가족", "부모님", "아이", "어린이"], "가족 여행"],
  [["커플", "신혼", "데이트"], "커플"],
  [["친구", "단체", "모임"], "친구/그룹"],
  [["혼자", "1인", "자유"], "혼행"],
  [["처음", "입문", "초보"], "초보 여행자"],
];

/**
 * 추천 대상 추론.
 */
export function inferRecommendedFor(productReviews: ReviewForSummary[]): string[] {
  const allText = productReviews
    .map((r) => (r.content ?? "").trim())
    .join(" ")
    .toLowerCase();
  const result: string[] = [];
  for (const [keywords, label] of RECOMMENDED_MAP) {
    if (keywords.some((k) => allText.includes(k))) result.push(label);
  }
  if (result.length === 0) result.push("여행 후기를 참고해 보시면 좋습니다.");
  return result;
}

const CAUTION_MAP: [string[], string][] = [
  [["대기", "줄", "혼잡"], "혼잡 주의"],
  [["추움", "더움", "날씨"], "날씨 변수 주의"],
  [["걷", "계단", "이동"], "도보/이동량 주의"],
  [["시간", "일정 빠듯", "타이트"], "일정 타이트함 주의"],
];

/**
 * 주의사항 추출.
 */
export function inferCautionPoints(productReviews: ReviewForSummary[]): string[] {
  const allText = productReviews
    .map((r) => (r.content ?? "").trim())
    .join(" ")
    .toLowerCase();
  const result: string[] = [];
  for (const [keywords, label] of CAUTION_MAP) {
    if (keywords.some((k) => allText.includes(k))) result.push(label);
  }
  return result;
}

/**
 * sentiment 라벨.
 */
export function getSentimentLabel(
  _productReviews: ReviewForSummary[],
  averageRating: number,
): ReviewSummarySentiment {
  if (averageRating >= 4.2) return "positive";
  if (averageRating >= 3.0) return "mixed";
  return "negative";
}

/**
 * 구조화 데이터로 2~4문장 요약 생성.
 */
export function buildSummaryText(summary: {
  averageRating: number;
  totalReviews: number;
  pros: string[];
  cons: string[];
  recommendedFor: string[];
}): string {
  const parts: string[] = [];
  if (summary.totalReviews === 0) {
    return "리뷰가 아직 없어 요약을 생성할 수 없습니다.";
  }
  if (summary.averageRating >= 4) {
    parts.push("전반적으로 만족도가 높은 상품으로, 일정 구성과 여행 편의성에 대한 긍정 평가가 많습니다.");
  } else if (summary.averageRating >= 3) {
    parts.push("전반적으로 보통 이상의 평가를 받고 있으며, 일부 항목에서 개선이 필요하다는 의견이 있습니다.");
  } else {
    parts.push("일부 리뷰에서 개선이 필요한 부분이 언급되었습니다.");
  }
  if (summary.cons.length > 0) {
    parts.push("반면 일부 리뷰에서는 이동 동선이나 대기 시간 등에 대한 아쉬움이 언급되었습니다.");
  }
  if (summary.recommendedFor.length > 0 && !summary.recommendedFor[0].includes("참고")) {
    parts.push(`${summary.recommendedFor[0]}에게 특히 적합한 편입니다.`);
  }
  if (parts.length === 0) {
    parts.push(`리뷰 ${summary.totalReviews}건을 바탕으로 요약한 내용입니다.`);
  }
  return parts.slice(0, 4).join(" ");
}

/**
 * 최근 14일 vs 이전 30일 기반 트렌드 요약 문장.
 */
function buildRecentTrendSummary(productReviews: ReviewForSummary[]): string {
  const recent = productReviews.filter((r) => isWithinLastDays(r.created_at, 14));
  const previous = productReviews.filter((r) => isBetweenDays(r.created_at, 14, 44));
  if (recent.length === 0 && previous.length === 0) {
    return "최근 리뷰 변화가 크지 않아 안정적인 상태입니다.";
  }
  const recentAvg = recent.length > 0 ? getAverageRating(recent as ReviewForAnomaly[]) : 0;
  const previousAvg = previous.length > 0 ? getAverageRating(previous as ReviewForAnomaly[]) : 0;
  const diff = recent.length - (previous.length / 30) * 14;
  if (diff > 2 && recentAvg >= previousAvg - 0.2) {
    return "최근 리뷰 수가 증가하고 있으며, 평점 흐름도 안정적입니다.";
  }
  if (diff > 2 && recentAvg < previousAvg - 0.3) {
    return "최근 리뷰는 늘었지만 평균 평점이 다소 하락했습니다.";
  }
  return "최근 리뷰 변화가 크지 않아 안정적인 상태입니다.";
}

/**
 * 상품별 리뷰 구조화 요약 생성.
 */
export function summarizeProductReviews(
  productReviews: ReviewForSummary[],
  productId: string,
): ProductReviewSummary {
  const totalReviews = productReviews.length;
  const averageRating = getAverageRating(productReviews as ReviewForAnomaly[]);
  const sentiment = getSentimentLabel(productReviews, averageRating);

  if (totalReviews === 0) {
    return {
      productId,
      totalReviews: 0,
      averageRating: 0,
      sentiment: "mixed",
      summaryText: "리뷰가 아직 없어 요약을 생성할 수 없습니다.",
      highlights: [],
      pros: [],
      cons: [],
      recommendedFor: [],
      cautionPoints: [],
      topKeywords: [],
      recentTrendSummary: "최근 리뷰 변화가 크지 않아 안정적인 상태입니다.",
    };
  }

  const { pros, cons } = extractProsAndCons(productReviews);
  const recommendedFor = inferRecommendedFor(productReviews);
  const cautionPoints = inferCautionPoints(productReviews);
  const topKeywords = totalReviews < 3 ? extractTopKeywords(productReviews, 3) : extractTopKeywords(productReviews, 5);

  const summaryForText = {
    averageRating,
    totalReviews,
    pros,
    cons,
    recommendedFor,
  };
  let summaryText: string;
  if (totalReviews < 3) {
    summaryText = "리뷰 수가 적어 요약 정확도가 낮을 수 있습니다. " + buildSummaryText(summaryForText);
  } else {
    summaryText = buildSummaryText(summaryForText);
  }

  const highlights = [...pros].slice(0, 3);
  const recentTrendSummary = buildRecentTrendSummary(productReviews);

  return {
    productId,
    totalReviews,
    averageRating,
    sentiment,
    summaryText,
    highlights,
    pros,
    cons,
    recommendedFor,
    cautionPoints,
    topKeywords,
    recentTrendSummary,
  };
}

/**
 * 전체 리뷰를 product_id 기준 그룹핑 후 상품별 요약 배열 생성.
 */
export function buildProductReviewSummaries(
  reviews: ReviewForSummary[],
): ProductReviewSummary[] {
  const byProduct = groupReviewsByProduct(reviews as ReviewForAnomaly[]);
  const result: ProductReviewSummary[] = [];
  for (const [productId, list] of byProduct) {
    result.push(summarizeProductReviews(list as ReviewForSummary[], productId));
  }
  result.sort((a, b) => b.totalReviews - a.totalReviews);
  return result;
}
