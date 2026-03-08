/**
 * PR24: 리뷰 신고 사유 분류 및 집계 타입.
 */

export type ReviewReportReason =
  | "spam"
  | "abusive"
  | "irrelevant"
  | "misleading"
  | "duplicate"
  | "other";

export interface ReviewReportSummary {
  reviewId: string;
  totalReports: number;
  reasons: Record<ReviewReportReason, number>;
  latestReportedAt?: string;
}

export type ReviewReportRow = {
  id: string;
  review_id: string;
  reason: string;
  created_at: string;
};
