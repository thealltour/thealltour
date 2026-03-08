/**
 * PR24: 리뷰 moderation 액션 이력 타입.
 */

export type ModerationActionType =
  | "auto_flagged"
  | "auto_under_review"
  | "auto_hidden"
  | "manually_hidden"
  | "manually_restored"
  | "marked_under_review"
  | "resolved";

export interface ReviewModerationHistoryItem {
  id: string;
  reviewId: string;
  actionType: ModerationActionType;
  fromStatus?: string;
  toStatus?: string;
  reason?: string;
  actorType: "system" | "admin";
  actorId?: string;
  createdAt: string;
}
