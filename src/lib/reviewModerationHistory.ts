/**
 * PR24: 리뷰 moderation 액션 이력 저장/조회.
 */
import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  ReviewModerationHistoryItem,
  ModerationActionType,
} from "@/types/reviewModerationHistory";

export async function createModerationHistoryLog(params: {
  reviewId: string;
  actionType: ModerationActionType;
  fromStatus?: string;
  toStatus?: string;
  reason?: string;
  actorType: "system" | "admin";
  actorId?: string;
}): Promise<ReviewModerationHistoryItem | null> {
  const { error, data } = await supabaseAdmin
    .from("review_moderation_history")
    .insert({
      review_id: params.reviewId,
      action_type: params.actionType,
      from_status: params.fromStatus ?? null,
      to_status: params.toStatus ?? null,
      reason: params.reason ?? null,
      actor_type: params.actorType,
      actor_id: params.actorId ?? null,
    })
    .select("id, review_id, action_type, from_status, to_status, reason, actor_type, actor_id, created_at")
    .single();

  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    reviewId: String(row.review_id),
    actionType: row.action_type as ModerationActionType,
    fromStatus: row.from_status != null ? String(row.from_status) : undefined,
    toStatus: row.to_status != null ? String(row.to_status) : undefined,
    reason: row.reason != null ? String(row.reason) : undefined,
    actorType: row.actor_type as "system" | "admin",
    actorId: row.actor_id != null ? String(row.actor_id) : undefined,
    createdAt: String(row.created_at),
  };
}

export async function getModerationHistoryByReviewId(
  reviewId: string,
  limit = 20,
): Promise<ReviewModerationHistoryItem[]> {
  const { data, error } = await supabaseAdmin
    .from("review_moderation_history")
    .select("id, review_id, action_type, from_status, to_status, reason, actor_type, actor_id, created_at")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    reviewId: String(row.review_id),
    actionType: row.action_type as ModerationActionType,
    fromStatus: row.from_status != null ? String(row.from_status) : undefined,
    toStatus: row.to_status != null ? String(row.to_status) : undefined,
    reason: row.reason != null ? String(row.reason) : undefined,
    actorType: row.actor_type as "system" | "admin",
    actorId: row.actor_id != null ? String(row.actor_id) : undefined,
    createdAt: String(row.created_at),
  }));
}
