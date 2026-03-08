/**
 * PR26: variant 별 리뷰 렌더 전략 생성.
 */
import type { PublicReviewItem } from "@/types/review";
import type { ReviewRenderStrategy, ReviewExperimentVariant } from "@/types/reviewExperiment";
import type { ProductReviewSummary } from "@/lib/reviewSummaries";

export type BuildStrategyContext = {
  productId: string;
  reviews: PublicReviewItem[];
  /** PR18 요약. summary_first variant에서 사용 */
  summary?: ProductReviewSummary | null;
  /** PR23 개인화 상단 노출용. personalized_highlights variant에서 사용 */
  personalizedHighlights?: PublicReviewItem[];
  /** 정렬용: trustScore 있음 */
  reviewsWithTrust?: PublicReviewItem[];
};

function sortByTrust(a: PublicReviewItem[], limit: number): PublicReviewItem[] {
  const withTrust = a.map((r) => ({
    r,
    t: (r as { trustScore?: number }).trustScore ?? 50,
  }));
  withTrust.sort((a, b) => b.t - a.t);
  return withTrust.slice(0, limit).map((x) => x.r);
}

function sortByHelpful(a: PublicReviewItem[], limit: number): PublicReviewItem[] {
  const copy = [...a];
  copy.sort((a, b) => (b.helpfulCount ?? 0) - (a.helpfulCount ?? 0));
  return copy.slice(0, limit);
}

/**
 * variant에 맞는 렌더 전략 반환.
 */
export function buildReviewRenderStrategy(
  variant: ReviewExperimentVariant,
  reviews: PublicReviewItem[],
  context: BuildStrategyContext,
): ReviewRenderStrategy {
  const limit = 10;
  const visible = reviews.filter((r) => (r.status ?? "submitted") === "submitted");

  switch (variant) {
    case "personalized_highlights": {
      const highlights = context.personalizedHighlights?.length
        ? context.personalizedHighlights.slice(0, 3)
        : [];
      const highlightIds = new Set(highlights.map((r) => r.id));
      const rest = visible.filter((r) => !highlightIds.has(r.id)).slice(0, limit - highlights.length);
      return {
        variant: "personalized_highlights",
        highlightReviews: highlights.length > 0 ? highlights : visible.slice(0, 3),
        showSummaryFirst: false,
        sortMode: "personalized",
        title: "이런 분께 잘 맞는 후기",
        subtitle: "선호에 맞춘 후기를 먼저 보여드려요",
      };
    }
    case "summary_first":
      return {
        variant: "summary_first",
        highlightReviews: visible.slice(0, 5),
        showSummaryFirst: !!context.summary?.summary_text,
        sortMode: "default",
        title: "리뷰 요약부터 확인해보세요",
        subtitle: "실제 여행자들의 요약된 의견을 먼저 볼 수 있어요",
      };
    case "trust_first": {
      const withTrust = context.reviewsWithTrust ?? visible;
      const ordered = sortByTrust(withTrust, limit);
      return {
        variant: "trust_first",
        highlightReviews: ordered,
        showSummaryFirst: false,
        sortMode: "trust",
        title: "신뢰도 높은 후기",
        subtitle: "검증된 후기를 우선 보여드려요",
      };
    }
    case "helpful_first": {
      const ordered = sortByHelpful(visible, limit);
      return {
        variant: "helpful_first",
        highlightReviews: ordered,
        showSummaryFirst: false,
        sortMode: "helpful",
        title: "많이 도움이 된 후기",
        subtitle: "다른 여행자들이 많이 도움이 됐다고 한 후기예요",
      };
    }
    default:
      return {
        variant: "control",
        highlightReviews: visible.slice(0, limit),
        showSummaryFirst: false,
        sortMode: "default",
        title: "추천 후기",
        subtitle: "실제 여행자들의 생생한 후기를 확인하세요",
      };
  }
}

export function getVariantReviewTitle(
  variant: ReviewExperimentVariant,
  _context?: { productId?: string },
): string {
  const titles: Record<ReviewExperimentVariant, string> = {
    control: "추천 후기",
    personalized_highlights: "이런 분께 잘 맞는 후기",
    summary_first: "리뷰 요약부터 확인해보세요",
    trust_first: "신뢰도 높은 후기",
    helpful_first: "많이 도움이 된 후기",
  };
  return titles[variant] ?? titles.control;
}

export function getVariantReviewSubtitle(
  variant: ReviewExperimentVariant,
  _context?: { productId?: string },
): string {
  const subtitles: Record<ReviewExperimentVariant, string> = {
    control: "실제 여행자들의 생생한 후기를 확인하세요",
    personalized_highlights: "선호에 맞춘 후기를 먼저 보여드려요",
    summary_first: "실제 여행자들의 요약된 의견을 먼저 볼 수 있어요",
    trust_first: "검증된 후기를 우선 보여드려요",
    helpful_first: "다른 여행자들이 많이 도움이 됐다고 한 후기예요",
  };
  return subtitles[variant] ?? subtitles.control;
}
