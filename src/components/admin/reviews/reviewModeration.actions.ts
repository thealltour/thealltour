export type ReviewModerationActionName = "hide" | "restore" | "under_review" | "resolve";

export type PostReviewModerationActionResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * 단건 리뷰 moderation API. 모바일/데스크톱 카드에서 공통 사용.
 */
export async function postReviewModerationAction(
  reviewId: string,
  action: ReviewModerationActionName,
  options?: { reason?: string },
): Promise<PostReviewModerationActionResult> {
  const res = await fetch(`/api/admin/reviews/${reviewId}/moderation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, reason: options?.reason }),
  });
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: false, message: data.message ?? "처리에 실패했습니다." };
}
