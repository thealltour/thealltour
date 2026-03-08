/**
 * PR22: 리뷰 SEO / 구조화 데이터 타입.
 */

export interface SeoEligibleReview {
  id: string;
  product_id?: string | null;
  productId?: string;
  rating: number;
  content: string;
  helpfulCount?: number;
  verified?: boolean;
  createdAt: string;
  recommendationScore?: number;
  trustScore?: number;
  status?: "visible" | "hidden" | "under_review" | "flagged";
  author_name?: string;
  title?: string;
  summary?: string;
}

export interface AggregateRatingSchema {
  "@type": "AggregateRating";
  ratingValue: number;
  reviewCount: number;
  bestRating: number;
  worstRating: number;
}

export interface ReviewSchema {
  "@type": "Review";
  reviewRating: {
    "@type": "Rating";
    ratingValue: number;
    bestRating: number;
    worstRating: number;
  };
  reviewBody: string;
  datePublished?: string;
  author?: {
    "@type": "Person";
    name: string;
  };
}

export interface ProductReviewStructuredData {
  "@context": "https://schema.org";
  "@type": "Product";
  name: string;
  aggregateRating?: AggregateRatingSchema;
  review?: ReviewSchema[];
}

export type ReviewSeoConfig = {
  minReviewLength: number;
  minTrustScore: number;
  maxRepresentativeReviews: number;
  minAggregateReviewCount: number;
};

export type SeoStructuredDataBuildResult = ProductReviewStructuredData | null;
