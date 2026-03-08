/**
 * PR27: 리뷰 전환 기여도 분석 타입.
 */

export type ReviewConversionEventType =
  | "review_impression"
  | "review_click"
  | "review_expand"
  | "review_helpful_click"
  | "review_summary_view"
  | "personalized_review_view"
  | "product_cta_click"
  | "product_inquiry"
  | "product_booking_start"
  | "product_conversion";

export interface ReviewInteractionEvent {
  eventId?: string;
  sessionKey?: string;
  userKey?: string;
  productId: string;
  reviewId?: string;
  experimentKey?: string;
  variant?: string;
  eventType: ReviewConversionEventType;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export type ConversionEventType =
  | "product_cta_click"
  | "product_inquiry"
  | "product_booking_start"
  | "product_conversion";

export interface ReviewConversionAttribution {
  sessionKey?: string;
  userKey?: string;
  productId: string;
  conversionEventType: ConversionEventType;
  conversionAt: string;
  attributedReviewIds: string[];
  attributedVariant?: string;
  attributionModel: "last_review_touch" | "weighted_review_touch" | "section_level_touch";
  attributionScore: number;
  reasons: string[];
}

export interface ReviewConversionSummary {
  productId: string;
  reviewId?: string;
  experimentKey?: string;
  variant?: string;
  impressions: number;
  clicks: number;
  expands: number;
  helpfulClicks: number;
  summaryViews: number;
  personalizedViews: number;
  conversions: number;
  assistedConversions: number;
  ctr: number;
  expandRate: number;
  conversionRate: number;
  assistedConversionRate: number;
  attributedRevenue?: number;
}

export interface ReviewVariantConversionSummary {
  productId: string;
  experimentKey?: string;
  variant?: string;
  impressions: number;
  conversions: number;
  conversionRate: number;
  assistedConversions: number;
}

export interface ReviewProductConversionSummary {
  productId: string;
  reviewImpressions: number;
  reviewInteractions: number;
  attributedConversions: number;
  reviewAssistRate: number;
}

export type ReviewTouchpoint = ReviewInteractionEvent & { weight?: number };

export interface ReviewSessionJourney {
  sessionKey: string;
  productId: string;
  events: ReviewInteractionEvent[];
  conversions: ReviewInteractionEvent[];
}

export interface ReviewAttributionWindowConfig {
  windowMinutes: number;
  lastTouchLookbackMinutes: number;
  maxAttributedReviewIds: number;
}
