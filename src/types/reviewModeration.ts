/**
 * PR20: 리뷰 Moderation 타입.
 * - visible = DB submitted
 * - hidden, under_review, flagged = DB 동일
 */
export type ReviewModerationStatus =
  | "visible"
  | "hidden"
  | "under_review"
  | "flagged";

export interface ReviewModerationInfo {
  reviewId: string;
  status: ReviewModerationStatus;
  reportCount: number;
  lastModeratedAt?: string;
  moderationReason?: string;
}

export interface ReviewReport {
  id: string;
  reviewId: string;
  reason: string;
  createdAt: string;
}

/** DB 저장용 status (submitted = visible) */
export type ReviewDbStatus =
  | "draft"
  | "submitted"
  | "hidden"
  | "under_review"
  | "flagged";

export function toDbStatus(status: ReviewModerationStatus): ReviewDbStatus {
  return status === "visible" ? "submitted" : status;
}

export function fromDbStatus(db: string | null | undefined): ReviewModerationStatus {
  if (db === "submitted") return "visible";
  if (db === "hidden" || db === "under_review" || db === "flagged") return db;
  return "visible";
}
