/**
 * PR16: 리뷰 분석 대시보드 결과 타입.
 */
import type { PublicReviewItem } from "@/types/review";

export interface ReviewAnalyticsResult {
  totalReviews: number;
  averageRating: number;
  verifiedRatio: number;
  ratingDistribution: Record<number, number>;
  topHelpfulReviews: PublicReviewItem[];
  topRecommendedReviews: PublicReviewItem[];
  recentReviewTrend: { date: string; count: number }[];
  /** PR21: Trust Score 구간별 리뷰 수 (0~20, 20~40, 40~60, 60~80, 80~100) */
  trustScoreDistribution?: { "0-20": number; "20-40": number; "40-60": number; "60-80": number; "80-100": number };
}
