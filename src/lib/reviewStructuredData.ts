/**
 * PR22: 리뷰 SEO 구조화 데이터(JSON-LD) 생성.
 * Product + AggregateRating + Review, 순수 함수.
 */
import type {
  AggregateRatingSchema,
  ProductReviewStructuredData,
  ReviewSchema,
  SeoEligibleReview,
  SeoStructuredDataBuildResult,
} from "@/types/reviewSeo";
import {
  getSeoEligibleReviews,
  getSeoRepresentativeReviews,
  shouldExposeAggregateRating,
} from "@/lib/reviewSeoVisibility";
import {
  sanitizeReviewBody,
  normalizeAuthorName,
  toIsoDate,
  compactJsonLd,
} from "@/lib/reviewSeoSanitizers";
import type { ReviewForSeoEligibility } from "@/lib/reviewSeoVisibility";
import { MAX_SEO_REPRESENTATIVE_REVIEWS } from "@/lib/reviewSeoConstants";

export type ProductForStructuredData = {
  name: string;
  id?: string;
};

/**
 * AggregateRating JSON-LD 객체.
 * eligible 리뷰 기준 평균·개수. reviewCount 0이면 null.
 */
export function buildAggregateRatingSchema(
  product: ProductForStructuredData,
  reviews: ReviewForSeoEligibility[],
  options?: { minTrustScore?: number; minLength?: number },
): AggregateRatingSchema | null {
  const eligible = getSeoEligibleReviews(reviews, options);
  if (eligible.length === 0) return null;
  const sum = eligible.reduce((s, r) => s + r.rating, 0);
  const ratingValue = Math.round((sum / eligible.length) * 10) / 10;
  return {
    "@type": "AggregateRating",
    ratingValue,
    reviewCount: eligible.length,
    bestRating: 5,
    worstRating: 1,
  };
}

/**
 * 개별 리뷰 → schema.org Review.
 */
export function buildReviewSchema(
  review: SeoEligibleReview,
  _product?: ProductForStructuredData,
): ReviewSchema | null {
  const body = sanitizeReviewBody(review.content);
  if (body == null || body.length === 0) return null;
  const rating = review.rating;
  if (rating < 1 || rating > 5) return null;
  return {
    "@type": "Review",
    reviewRating: {
      "@type": "Rating",
      ratingValue: rating,
      bestRating: 5,
      worstRating: 1,
    },
    reviewBody: body,
    datePublished: toIsoDate(review.createdAt),
    author: {
      "@type": "Person",
      name: normalizeAuthorName(review.author_name),
    },
  };
}

/**
 * Product + AggregateRating + Review 배열 전체 JSON-LD.
 * aggregateRating는 shouldExposeAggregateRating일 때만 포함.
 * review는 대표 리뷰 최대 3개.
 */
export function buildProductReviewStructuredData(
  product: ProductForStructuredData,
  reviews: ReviewForSeoEligibility[],
  options?: {
    minTrustScore?: number;
    minLength?: number;
    minAggregateCount?: number;
    maxRepresentative?: number;
  },
): SeoStructuredDataBuildResult {
  const name = product.name?.trim();
  if (!name) return null;

  const eligible = getSeoEligibleReviews(reviews, options);
  const representative = getSeoRepresentativeReviews(
    reviews,
    options?.maxRepresentative ?? MAX_SEO_REPRESENTATIVE_REVIEWS,
    options,
  );

  const hasAggregate = shouldExposeAggregateRating(reviews, {
    ...options,
    minCount: options?.minAggregateCount,
  });
  const aggregate = hasAggregate
    ? buildAggregateRatingSchema(product, reviews, options)
    : null;

  const reviewSchemas = representative
    .map((r) => buildReviewSchema(r, product))
    .filter((r): r is ReviewSchema => r != null);

  if (!aggregate && reviewSchemas.length === 0) return null;

  const out: ProductReviewStructuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
  };
  if (aggregate) out.aggregateRating = aggregate;
  if (reviewSchemas.length > 0) out.review = reviewSchemas;

  return out;
}

/**
 * JSON-LD script 삽입용 문자열.
 * undefined 제거, XSS 방지 위해 JSON.stringify만 사용 (값은 이미 sanitize됨).
 */
export function serializeStructuredData(data: ProductReviewStructuredData | null): string {
  if (data == null) return "";
  const compact = compactJsonLd(data as unknown as Record<string, unknown>);
  return JSON.stringify(compact);
}
