/**
 * PR28: 상품 리뷰에서 강점/약점/반복 불만/추천·전환 포인트 추출.
 * 순수 함수, UI 의존 없음.
 */
import type { ReviewForInsight } from "./reviewInsightSelectors";
import type { ProductReviewSummaryLike } from "./reviewInsightSelectors";
import type { ReviewProductConversionSummary } from "@/types/reviewConversionAnalytics";

const MIN_REVIEWS_FOR_INSIGHT = 3;
const MAX_STRENGTHS = 5;
const MAX_WEAKNESSES = 5;
const MAX_RECURRING_COMPLAINTS = 5;
const MAX_RECOMMENDATION_DRIVERS = 5;
const MAX_CONVERSION_DRIVERS = 3;

/** 반복 불만 키워드 그룹 (한글) */
const COMPLAINT_KEYWORDS: Record<string, string[]> = {
  이동_동선: ["이동", "동선", "차량", "버스", "이동이 많", "멀다", "힘들다"],
  일정_빠듯: ["일정", "빠듯", "바쁘", "여유", "쉬는 시간"],
  대기_시간: ["대기", "기다리", "대기 시간", "줄"],
  식사_품질: ["식사", "밥", "맛없", "식당", "식비"],
  숙소_청결: ["숙소", "호텔", "방", "청결", "더럽"],
  가격_아쉬움: ["가격", "비싸", "가성비", "대비", "아쉬"],
  쇼핑_과다: ["쇼핑", "쇼핑몰", "강제", "들르"],
  자유시간_부족: ["자유시간", "자유 시간", "개인 시간", "여유"],
};

/** 강점 문구 템플릿 */
const STRENGTH_TEMPLATES: Record<string, string> = {
  일정: "일정 구성이 알차다는 평가가 많습니다.",
  가이드: "가이드/응대 친절도에 대한 만족도가 높습니다.",
  초보: "처음 방문하는 여행자도 편하게 이용했다는 후기가 많습니다.",
  풍경: "풍경·포토스팟에 대한 만족도가 높습니다.",
  가성비: "가성비가 좋다는 평가가 많습니다.",
  일정_효율: "일정 효율이 좋다는 의견이 많습니다.",
};

/** 약점 문구 템플릿 */
const WEAKNESS_TEMPLATES: Record<string, string> = {
  동선: "이동 동선이 길다는 불만이 반복됩니다.",
  일정_빠듯: "일정이 다소 빠듯하다는 의견이 있습니다.",
  대기: "대기 시간 관련 불편 언급이 누적되고 있습니다.",
  식사: "식사 품질에 대한 아쉬움이 있습니다.",
  숙소: "숙소/방 청결 관련 지적이 있습니다.",
  가격: "가격 대비 아쉬움이 언급됩니다.",
  쇼핑: "쇼핑 일정이 많다는 의견이 있습니다.",
  자유시간: "자유시간이 부족하다는 의견이 있습니다.",
};

function normalizeText(s: string | undefined): string {
  if (!s || typeof s !== "string") return "";
  return s.trim().replace(/\s+/g, " ");
}

/**
 * 상품 리뷰에서 반복적으로 긍정 평가되는 요소 추출.
 */
export function extractTopStrengthsFromReviews(
  reviews: ReviewForInsight[],
  summary?: ProductReviewSummaryLike | null,
): string[] {
  const out: string[] = [];
  if (summary?.positive_points?.length) {
    for (const p of summary.positive_points.slice(0, MAX_STRENGTHS)) {
      const t = normalizeText(p);
      if (t.length >= 2) out.push(t.endsWith(".") ? t : `${t}에 대한 만족도가 높습니다.`);
    }
  }
  if (reviews.length < MIN_REVIEWS_FOR_INSIGHT) return out.slice(0, 2);
  const highRating = reviews.filter((r) => (r.rating ?? 0) >= 4);
  if (highRating.length >= 2 && out.length < MAX_STRENGTHS) {
    if (out.every((x) => !x.includes("일정 구성"))) out.push(STRENGTH_TEMPLATES.일정);
    if (out.every((x) => !x.includes("가이드") && !x.includes("응대"))) out.push(STRENGTH_TEMPLATES.가이드);
  }
  return out.slice(0, MAX_STRENGTHS);
}

/**
 * 부정 평가가 반복되는 요소 추출.
 */
export function extractTopWeaknessesFromReviews(
  reviews: ReviewForInsight[],
  summary?: ProductReviewSummaryLike | null,
): string[] {
  const out: string[] = [];
  if (summary?.negative_points?.length) {
    for (const n of summary.negative_points.slice(0, MAX_WEAKNESSES)) {
      const t = normalizeText(n);
      if (t.length >= 2) out.push(t.endsWith(".") ? t : `${t}에 대한 불만이 있습니다.`);
    }
  }
  if (reviews.length < MIN_REVIEWS_FOR_INSIGHT) return out.slice(0, 2);
  const lowRating = reviews.filter((r) => (r.rating ?? 0) <= 2);
  if (lowRating.length >= 1) {
    const texts = [
      ...reviews.map((r) => [r.content_bad, r.content, r.summary].filter(Boolean).join(" ")),
    ].map(normalizeText);
    for (const [key, keywords] of Object.entries(COMPLAINT_KEYWORDS)) {
      const match = keywords.some((k) => texts.some((t) => t.includes(k)));
      if (match && WEAKNESS_TEMPLATES[key as keyof typeof WEAKNESS_TEMPLATES]) {
        const msg = WEAKNESS_TEMPLATES[key as keyof typeof WEAKNESS_TEMPLATES];
        if (!out.includes(msg)) out.push(msg);
      }
    }
  }
  return out.slice(0, MAX_WEAKNESSES);
}

/**
 * 동일/유사 불만 포인트 반복 감지.
 */
export function extractRecurringComplaints(
  reviews: ReviewForInsight[],
  minTrustForComplaint?: number,
): string[] {
  if (reviews.length < MIN_REVIEWS_FOR_INSIGHT) return [];
  const texts = reviews
    .filter((r) => {
      const trust = (r as ReviewForInsight & { trustScore?: number }).trustScore;
      if (minTrustForComplaint != null && (trust ?? 100) < minTrustForComplaint) return false;
      return (r.rating ?? 0) <= 3 || (r.content_bad ?? "").trim().length > 0;
    })
    .flatMap((r) => [r.content_bad, (r.content ?? "").slice(0, 500)].filter(Boolean))
    .map(normalizeText)
    .filter((t) => t.length >= 10);
  const countByLabel = new Map<string, number>();
  for (const [label, keywords] of Object.entries(COMPLAINT_KEYWORDS)) {
    const count = texts.filter((t) => keywords.some((k) => t.includes(k))).length;
    if (count >= 2) countByLabel.set(label, count);
  }
  const sorted = [...countByLabel.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_RECURRING_COMPLAINTS);
  return sorted
    .map(([label]) => WEAKNESS_TEMPLATES[label as keyof typeof WEAKNESS_TEMPLATES])
    .filter(Boolean);
}

/**
 * 사용자가 이 상품을 추천하는 핵심 이유 추출.
 */
export function extractRecommendationDrivers(
  reviews: ReviewForInsight[],
  summary?: ProductReviewSummaryLike | null,
): string[] {
  const out: string[] = [];
  if (summary?.recommended_for?.length) {
    for (const r of summary.recommended_for.slice(0, MAX_RECOMMENDATION_DRIVERS)) {
      const t = normalizeText(r);
      if (t.length >= 2) out.push(t);
    }
  }
  if (reviews.length < MIN_REVIEWS_FOR_INSIGHT) return out;
  const highHelpful = reviews
    .filter((r) => (r.helpfulCount ?? 0) >= 1 && (r.rating ?? 0) >= 4)
    .slice(0, 20);
  const has가성비 = highHelpful.some((r) => {
    const t = [r.content, r.content_good, r.summary].filter(Boolean).join(" ");
    return /가성비|가격.*좋|저렴|합리적/.test(t);
  });
  if (has가성비 && !out.some((x) => x.includes("가성비"))) out.push("가성비");
  const has초보 = highHelpful.some((r) => {
    const t = [r.content, r.content_good].filter(Boolean).join(" ");
    return /처음|첫|초보|처음.*여행/.test(t);
  });
  if (has초보 && !out.some((x) => x.includes("초보") || x.includes("처음"))) out.push("초보 여행자 친화성");
  return out.slice(0, MAX_RECOMMENDATION_DRIVERS);
}

/**
 * 전환에 기여한 리뷰 특성/포인트 추출.
 */
export function extractConversionDrivers(
  conversionData: ReviewProductConversionSummary | null | undefined,
  reviews: ReviewForInsight[],
): string[] {
  const out: string[] = [];
  if (!conversionData || conversionData.reviewInteractions < 5) {
    return ["아직 전환 기여 데이터가 충분하지 않습니다."];
  }
  if (conversionData.attributedConversions > 0 && conversionData.reviewAssistRate > 0) {
    out.push("리뷰 노출·상호작용이 CTA 클릭 및 문의와 연결되고 있습니다.");
  }
  const highHelpful = reviews.filter((r) => (r.helpfulCount ?? 0) >= 2).length;
  if (highHelpful >= 2) {
    out.push("도움됨 투표가 많은 리뷰가 전환 기여에 기여할 가능성이 있습니다.");
  }
  if (reviews.some((r) => ((r as ReviewForInsight & { trustScore?: number }).trustScore ?? 0) >= 60)) {
    out.push("신뢰도가 높은 리뷰가 상품 전환에 긍정적으로 기여하고 있습니다.");
  }
  return out.slice(0, MAX_CONVERSION_DRIVERS);
}
