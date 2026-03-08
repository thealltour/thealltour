/**
 * PR28: 리뷰 기반 상품 인사이트 리포트 타입.
 */

export type ProductReviewSentiment = "positive" | "mixed" | "negative";
export type ProductReviewHealth = "healthy" | "watch" | "risk";

export interface ProductReviewInsightReport {
  productId: string;
  totalReviews: number;
  averageRating: number;
  sentiment: ProductReviewSentiment;
  reviewHealth: ProductReviewHealth;
  summaryText: string;
  topStrengths: string[];
  topWeaknesses: string[];
  recurringComplaints: string[];
  recommendationDrivers: string[];
  conversionDrivers: string[];
  trustWarnings: string[];
  anomalyWarnings: string[];
  moderationWarnings: string[];
  operationalSuggestions: string[];
  improvementPriorities: string[];
  trendSummary: string;
  generatedAt: string;
}

export interface ProductInsightSection {
  label: string;
  items: string[];
}

export interface ProductReviewHealthSummary {
  productId: string;
  reviewHealth: ProductReviewHealth;
  reasons: string[];
}

export interface ProductReviewInsightSourceData {
  reviews: unknown[];
  reviewSummary?: unknown;
  anomalyData?: unknown;
  conversionData?: unknown;
  moderationData?: unknown;
  trustAggregates?: unknown;
}

export type ProductInsightSeverity = "high" | "medium" | "low";

export type ProductInsightTrend = "improving" | "stable" | "declining" | "unknown";

export interface ProductInsightPriorityItem {
  productId: string;
  priority: number;
  label: string;
  reason?: string;
}
