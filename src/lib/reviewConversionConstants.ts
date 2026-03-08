/**
 * PR27: 리뷰 전환 attribution 규칙/가중치 상수.
 */

export const REVIEW_ATTRIBUTION_WINDOW_MINUTES = 60;
export const REVIEW_LAST_TOUCH_LOOKBACK_MINUTES = 30;
export const REVIEW_MAX_ATTRIBUTED_REVIEW_IDS = 3;

export const REVIEW_EXPAND_WEIGHT = 1.5;
export const REVIEW_CLICK_WEIGHT = 1.2;
export const REVIEW_SUMMARY_VIEW_WEIGHT = 0.8;
export const REVIEW_PERSONALIZED_VIEW_WEIGHT = 1.0;
export const REVIEW_HELPFUL_CLICK_WEIGHT = 1.4;
export const REVIEW_IMPRESSION_WEIGHT = 0.3;

export const CONVERSION_EVENT_TYPES = [
  "product_cta_click",
  "product_inquiry",
  "product_booking_start",
  "product_conversion",
] as const;

export const REVIEW_INTERACTION_EVENT_TYPES = [
  "review_impression",
  "review_click",
  "review_expand",
  "review_helpful_click",
  "review_summary_view",
  "personalized_review_view",
] as const;
