/**
 * PR22: 리뷰 SEO 포함 기준 상수.
 * 운영 정책에 따라 조정 가능.
 */

export const MIN_SEO_REVIEW_LENGTH = 20;
export const MIN_SEO_TRUST_SCORE = 50;
export const MAX_SEO_REPRESENTATIVE_REVIEWS = 3;
export const MIN_SEO_AGGREGATE_REVIEW_COUNT = 1;

/** AggregateRating 노출 최소 리뷰 수 (1이면 eligible 1개만 있어도 노출) */
export const SEO_AGGREGATE_MIN_COUNT = MIN_SEO_AGGREGATE_REVIEW_COUNT;
