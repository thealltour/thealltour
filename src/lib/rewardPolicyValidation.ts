/**
 * 리워드(경품 교환) 정책 검증
 *
 * 검증 위치: POST /api/me/rewards/redemptions (canonical).
 * 레거시 호환: POST /api/rewards/redemptions 는 동일 핸들러를 re-export 할 수 있음.
 * - 최소 교환 포인트
 * - 월 교환 횟수 제한
 * - CONFIRMED 포인트만 사용: point_balance 사용으로 이미 충족 (pending 미포함)
 * - 악용 방지: 동일 계정 rate limit, 반려/취소 누적 시 차단
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getRewardPolicy } from "@/config/rewardPolicy";

export type ValidateRedemptionResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * 교환 신청 정책 검증. API route에서 catalog/member 조회 후, insert 전에 호출.
 */
export async function validateRedemptionPolicy(
  userId: string,
  pointCost: number,
  supabase: SupabaseClient,
): Promise<ValidateRedemptionResult> {
  const policy = getRewardPolicy();

  if (pointCost < policy.minRedeemPoint) {
    return {
      ok: false,
      message: `교환 가능한 최소 포인트는 ${policy.minRedeemPoint.toLocaleString()}P입니다.`,
    };
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count: monthlyCount, error: monthlyErr } = await supabase
    .from("reward_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["REQUESTED", "APPROVED", "SHIPPED", "COMPLETED"])
    .gte("created_at", startOfMonth);

  if (monthlyErr) {
    return { ok: false, message: "교환 한도 확인에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }
  if ((monthlyCount ?? 0) >= policy.monthlyRedeemLimit) {
    return {
      ok: false,
      message: `이번 달 교환 신청 한도(${policy.monthlyRedeemLimit}회)를 모두 사용하셨습니다.`,
    };
  }

  if (policy.rateLimitWindowMinutes > 0 && policy.rateLimitMaxRequests > 0) {
    const windowStart = new Date(now.getTime() - policy.rateLimitWindowMinutes * 60 * 1000).toISOString();
    const { count: recentCount, error: rateErr } = await supabase
      .from("reward_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "REQUESTED")
      .gte("created_at", windowStart);

    if (!rateErr && (recentCount ?? 0) >= policy.rateLimitMaxRequests) {
      return {
        ok: false,
        message: "잠시 후 다시 시도해 주세요. (요청이 너무 많습니다.)",
      };
    }
  }

  if (policy.rejectLookbackDays > 0 && policy.rejectThreshold > 0) {
    const lookbackStart = new Date(now.getTime() - policy.rejectLookbackDays * 24 * 60 * 60 * 1000).toISOString();
    const { count: rejectCount, error: rejectErr } = await supabase
      .from("reward_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["REJECTED", "CANCELED"])
      .gte("updated_at", lookbackStart);

    if (!rejectErr && (rejectCount ?? 0) >= policy.rejectThreshold) {
      return {
        ok: false,
        message: "최근 반려/취소 횟수가 많아 자동 신청이 제한됩니다. 고객센터로 문의해 주세요.",
      };
    }
  }

  return { ok: true };
}
