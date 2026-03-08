/**
 * PR10: 리뷰 작성 보상 서비스.
 * - 인증 후기(eligibility_id 있음) 제출 시에만 보상 지급.
 * - review_id당 1회만 지급 (DB UNIQUE + 코드 확인).
 */
import "server-only";
import { supabase } from "@/lib/supabase";

export const REWARD_TYPE_REVIEW_WRITE = "review_write";
export const DEFAULT_REVIEW_WRITE_POINTS = 1000;

export type ReviewForReward = {
  id: string;
  member_id?: string;
  status?: string;
  eligibility_id?: string | null;
};

export type CreateReviewRewardResult = {
  rewardCreated: boolean;
  points: number;
};

/**
 * 인증 후기 제출 시 보상 지급.
 * - eligibility_id 없거나 status !== 'submitted' 이면 지급하지 않음.
 * - 이미 해당 review_id로 지급된 경우 추가 지급 없음.
 */
export async function createReviewReward(
  review: ReviewForReward,
  options?: { points?: number },
): Promise<CreateReviewRewardResult> {
  if (!review.id || review.status !== "submitted" || !review.eligibility_id) {
    return { rewardCreated: false, points: 0 };
  }

  const memberId = review.member_id?.trim();
  if (!memberId) {
    return { rewardCreated: false, points: 0 };
  }

  const { data: existing } = await supabase
    .from("review_rewards")
    .select("id, points")
    .eq("review_id", review.id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const points = typeof (existing as { points?: number }).points === "number"
      ? (existing as { points: number }).points
      : 0;
    return { rewardCreated: false, points };
  }

  const points = options?.points ?? DEFAULT_REVIEW_WRITE_POINTS;
  const { error } = await supabase.from("review_rewards").insert({
    review_id: review.id,
    member_id: memberId,
    reward_type: REWARD_TYPE_REVIEW_WRITE,
    points,
  });

  if (error) {
    return { rewardCreated: false, points: 0 };
  }

  return { rewardCreated: true, points };
}
