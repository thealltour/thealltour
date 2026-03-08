/**
 * PR21: 리뷰 Trust Score 타입.
 */

export interface ReviewTrustScore {
  reviewId: string;
  trustScore: number;
  qualityScore: number;
  engagementScore: number;
  credibilityScore: number;
  riskPenalty: number;
}

/** Trust Score 구간별 라벨 (관리자 UI) */
export type ReviewTrustBand = "trusted" | "high" | "medium" | "low" | "risk";

export function getTrustBand(score: number): ReviewTrustBand {
  if (score >= 90) return "trusted";
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  if (score >= 30) return "low";
  return "risk";
}
