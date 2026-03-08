/**
 * PR25: 작성자 단위 신뢰 프로필 및 패턴 분석 타입.
 */

export type AuthorRiskLevel = "low" | "medium" | "high";

export interface ReviewAuthorProfile {
  authorKey: string;
  displayName?: string;
  totalReviews: number;
  averageRating: number;
  verifiedReviewCount: number;
  unverifiedReviewCount: number;
  helpfulReceivedTotal: number;
  averageReviewLength: number;
  extremeRatingRatio: number;
  duplicateContentRatio: number;
  lowTrustReviewRatio: number;
  flaggedReviewRatio: number;
  recentReviewCount: number;
  authorTrustScore: number;
  authorRiskLevel: AuthorRiskLevel;
  patternSignals: string[];
}

export interface ReviewAuthorPatternAnalysis {
  authorKey: string;
  hasExtremeBias: boolean;
  hasDuplicatePattern: boolean;
  hasBurstPattern: boolean;
  hasLowQualityPattern: boolean;
  hasLowTrustPattern: boolean;
  signals: string[];
}

export interface ReviewAuthorSummary {
  authorKey: string;
  totalReviews: number;
  authorTrustScore: number;
  authorRiskLevel: AuthorRiskLevel;
}

export interface AuthorReviewStats {
  totalReviews: number;
  verifiedCount: number;
  helpfulTotal: number;
  averageLength: number;
  extremeRatingCount: number;
  duplicateLikeCount: number;
  lowTrustCount: number;
  flaggedCount: number;
  recentCount: number;
}

export type AuthorRiskReason =
  | "extreme_bias"
  | "duplicate_pattern"
  | "burst_pattern"
  | "low_quality"
  | "low_trust";
