/**
 * PR20: 관리자 Moderation 액션 (hide / restore / under_review / resolve).
 * PR24: batch 액션, history 로깅.
 */
import "server-only";

import { updateReviewStatus } from "@/lib/reviewModeration";
import { createModerationHistoryLog } from "@/lib/reviewModerationHistory";

export async function hideReview(reviewId: string, reason?: string): Promise<boolean> {
  const ok = await updateReviewStatus(reviewId, "hidden", reason);
  if (ok) {
    await createModerationHistoryLog({
      reviewId,
      actionType: "manually_hidden",
      toStatus: "hidden",
      reason,
      actorType: "admin",
    });
  }
  return ok;
}

export async function restoreReview(reviewId: string): Promise<boolean> {
  const ok = await updateReviewStatus(reviewId, "visible");
  if (ok) {
    await createModerationHistoryLog({
      reviewId,
      actionType: "manually_restored",
      toStatus: "submitted",
      actorType: "admin",
    });
  }
  return ok;
}

export async function markReviewUnderReview(reviewId: string, reason?: string): Promise<boolean> {
  const ok = await updateReviewStatus(reviewId, "under_review", reason);
  if (ok) {
    await createModerationHistoryLog({
      reviewId,
      actionType: "marked_under_review",
      toStatus: "under_review",
      reason,
      actorType: "admin",
    });
  }
  return ok;
}

export async function resolveReviewReport(reviewId: string): Promise<boolean> {
  const ok = await updateReviewStatus(reviewId, "visible");
  if (ok) {
    await createModerationHistoryLog({
      reviewId,
      actionType: "resolved",
      toStatus: "submitted",
      actorType: "admin",
    });
  }
  return ok;
}

export type BatchActionResult = {
  successIds: string[];
  failedIds: string[];
  totalProcessed: number;
};

export async function batchHideReviews(
  reviewIds: string[],
  reason?: string,
): Promise<BatchActionResult> {
  const successIds: string[] = [];
  const failedIds: string[] = [];
  for (const id of reviewIds) {
    const ok = await hideReview(id, reason);
    if (ok) successIds.push(id);
    else failedIds.push(id);
  }
  return { successIds, failedIds, totalProcessed: reviewIds.length };
}

export async function batchRestoreReviews(reviewIds: string[]): Promise<BatchActionResult> {
  const successIds: string[] = [];
  const failedIds: string[] = [];
  for (const id of reviewIds) {
    const ok = await restoreReview(id);
    if (ok) successIds.push(id);
    else failedIds.push(id);
  }
  return { successIds, failedIds, totalProcessed: reviewIds.length };
}

export async function batchMarkReviewsUnderReview(
  reviewIds: string[],
  reason?: string,
): Promise<BatchActionResult> {
  const successIds: string[] = [];
  const failedIds: string[] = [];
  for (const id of reviewIds) {
    const ok = await markReviewUnderReview(id, reason);
    if (ok) successIds.push(id);
    else failedIds.push(id);
  }
  return { successIds, failedIds, totalProcessed: reviewIds.length };
}

export async function batchResolveReviewReports(reviewIds: string[]): Promise<BatchActionResult> {
  const successIds: string[] = [];
  const failedIds: string[] = [];
  for (const id of reviewIds) {
    const ok = await resolveReviewReport(id);
    if (ok) successIds.push(id);
    else failedIds.push(id);
  }
  return { successIds, failedIds, totalProcessed: reviewIds.length };
}
