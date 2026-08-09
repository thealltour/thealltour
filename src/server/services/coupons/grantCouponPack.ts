import "server-only";

import { COUPON_PACKS } from "@/lib/coupons/couponPacks";
import { getPointExpiresAt } from "@/config/rewardPolicy";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CouponPackTier, MemberCouponPackRow } from "@/types/coupons";

export type GrantCouponPackParams = {
  userId: string;
  tier: CouponPackTier;
  sourceRefType: string;
  sourceRefId: string;
  reason?: string;
  expiresAt?: string | null;
  notificationTitle?: string;
  notificationBody?: string;
  /** true면 동일 소스 기지급 시 already_granted 반환 */
  skipIfExists?: boolean;
};

export type GrantCouponPackResult =
  | { granted: true; packId: string; ledgerId: string }
  | { granted: false; reason: "already_granted" };

export async function grantCouponPack(
  params: GrantCouponPackParams,
): Promise<GrantCouponPackResult> {
  const userId = params.userId.trim();
  const sourceRefType = params.sourceRefType.trim();
  const sourceRefId = params.sourceRefId.trim();
  if (!userId) throw new Error("userId는 필수입니다.");
  if (!sourceRefType || !sourceRefId) throw new Error("sourceRefType/sourceRefId는 필수입니다.");

  const packDef = COUPON_PACKS[params.tier];
  const skipIfExists = params.skipIfExists !== false;

  if (skipIfExists) {
    const { data: existing } = await supabaseAdmin
      .from("member_coupon_packs")
      .select("id")
      .eq("user_id", userId)
      .eq("source_ref_type", sourceRefType)
      .eq("source_ref_id", sourceRefId)
      .maybeSingle();
    if (existing?.id) {
      return { granted: false, reason: "already_granted" };
    }
  }

  const { data: member, error: memberErr } = await supabaseAdmin
    .from("members")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (memberErr || !member) throw new Error("회원을 찾을 수 없습니다.");

  const now = new Date().toISOString();
  const expiresAt = params.expiresAt === undefined ? getPointExpiresAt() : params.expiresAt;

  const { data: packRow, error: packErr } = await supabaseAdmin
    .from("member_coupon_packs")
    .insert({
      user_id: userId,
      tier: params.tier,
      unit_amount: packDef.amount,
      status: "AVAILABLE",
      source_ref_type: sourceRefType,
      source_ref_id: sourceRefId,
      expires_at: expiresAt,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .maybeSingle();

  if (packErr) {
    if (packErr.code === "23505") {
      return { granted: false, reason: "already_granted" };
    }
    throw new Error(packErr.message || "쿠폰팩 발급에 실패했습니다.");
  }
  if (!packRow) throw new Error("쿠폰팩 발급에 실패했습니다.");

  const pack = packRow as MemberCouponPackRow;
  const reason = params.reason?.trim() || packDef.reason;

  const { data: ledgerRow, error: ledgerErr } = await supabaseAdmin
    .from("coupon_ledger")
    .insert({
      user_id: userId,
      pack_id: pack.id,
      type: "ISSUE",
      status: "CONFIRMED",
      amount: packDef.amount,
      reason,
      ref_type: sourceRefType,
      ref_id: sourceRefId,
      created_at: now,
    })
    .select("id")
    .maybeSingle();

  if (ledgerErr || !ledgerRow) {
    await supabaseAdmin.from("member_coupon_packs").delete().eq("id", pack.id);
    throw new Error(ledgerErr?.message || "쿠폰 원장 기록에 실패했습니다.");
  }

  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    type: "POINT_EARNED",
    title: params.notificationTitle?.trim() || "쿠폰팩 지급",
    body:
      params.notificationBody?.trim() ||
      `${packDef.reason}이 지급되었습니다. 골프투어 예약 시 1인당 ${packDef.amount.toLocaleString("ko-KR")}원 할인이 적용됩니다.`,
  });

  return {
    granted: true,
    packId: pack.id,
    ledgerId: String((ledgerRow as { id: string }).id),
  };
}
