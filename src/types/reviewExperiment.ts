/**
 * PR26: 리뷰 A/B 노출 실험 타입.
 */

export type ReviewExperimentKey =
  | "review_highlight_variant"
  | "review_summary_variant"
  | "review_sort_variant";

export type ReviewExperimentVariant =
  | "control"
  | "personalized_highlights"
  | "summary_first"
  | "trust_first"
  | "helpful_first";

export interface ReviewExperimentAssignment {
  experimentKey: ReviewExperimentKey;
  variant: ReviewExperimentVariant;
  assignedAt?: string;
  subjectKey?: string;
}

export type ReviewExperimentEventType =
  | "impression"
  | "click_review"
  | "expand_review"
  | "click_helpful"
  | "view_summary"
  | "conversion";

export interface ReviewExperimentExposureEvent {
  experimentKey: ReviewExperimentKey;
  variant: ReviewExperimentVariant;
  productId: string;
  reviewId?: string;
  eventType: ReviewExperimentEventType;
  createdAt?: string;
}

export interface ReviewExperimentResultSummary {
  experimentKey: ReviewExperimentKey;
  variant: ReviewExperimentVariant;
  impressions: number;
  clicks: number;
  expands: number;
  helpfulClicks: number;
  conversions: number;
  ctr: number;
  expandRate: number;
  conversionRate: number;
}

export interface ReviewExperimentConfig {
  key: ReviewExperimentKey;
  variants: readonly ReviewExperimentVariant[];
  defaultVariant: ReviewExperimentVariant;
  rolloutPercent?: Record<ReviewExperimentVariant, number>;
}

export type ReviewSortMode = "default" | "trust" | "helpful" | "personalized";

export interface ReviewRenderStrategy {
  variant: ReviewExperimentVariant;
  highlightReviews: import("@/types/review").PublicReviewItem[];
  showSummaryFirst: boolean;
  sortMode: ReviewSortMode;
  title?: string;
  subtitle?: string;
}

export type ReviewVariantRenderMode = "control" | "personalized" | "summary_first" | "trust" | "helpful";
