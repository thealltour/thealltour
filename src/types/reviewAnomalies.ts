/**
 * PR17: 리뷰 이상 감지 결과 타입.
 */

export interface RatingDropProduct {
  productId: string;
  previousAverageRating: number;
  recentAverageRating: number;
  ratingDelta: number;
  previousCount: number;
  recentCount: number;
}

export interface ReviewSurgeProduct {
  productId: string;
  recent7dCount: number;
  previous30dCount: number;
  recent7dPerDay: number;
  previous30dPerDay: number;
  surgeRatio: number;
}

export interface SuspiciousReviewItem {
  id: string;
  productId: string;
  rating: number;
  helpfulCount: number;
  verified: boolean;
  createdAt: string;
  contentPreview: string;
  reasons: string[];
  riskScore: number;
}

export type ReviewAnomalyAlertType =
  | "rating_drop"
  | "review_surge"
  | "suspicious_review";

export type ReviewAnomalySeverity = "high" | "medium" | "low";

export interface ReviewAnomalyAlert {
  type: ReviewAnomalyAlertType;
  severity: ReviewAnomalySeverity;
  title: string;
  description: string;
  productId?: string;
  reviewId?: string;
  createdAt?: string;
}

export interface ReviewAnomalyResult {
  ratingDropProducts: RatingDropProduct[];
  surgeProducts: ReviewSurgeProduct[];
  suspiciousReviews: SuspiciousReviewItem[];
  alerts: ReviewAnomalyAlert[];
  summary: {
    totalAlerts: number;
    ratingDropCount: number;
    surgeCount: number;
    suspiciousReviewCount: number;
  };
}
