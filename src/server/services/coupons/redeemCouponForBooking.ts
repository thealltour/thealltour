import "server-only";

import { COUPON_PACKS } from "@/lib/coupons/couponPacks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { MemberCouponPackRow } from "@/types/coupons";

export async function redeemCouponForBooking(params: {
  userId: string;
  bookingId: string;
  packId?: string | null;
}): Promise<void> {
  const bookingId = params.bookingId.trim();
  const userId = params.userId.trim();
  if (!bookingId || !userId) return;

  let packQuery = supabaseAdmin
    .from("member_coupon_packs")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "RESERVED")
    .eq("reserved_booking_id", bookingId);

  if (params.packId) {
    packQuery = packQuery.eq("id", params.packId);
  }

  const { data: packRow } = await packQuery.maybeSingle();
  if (!packRow) return;

  const pack = packRow as MemberCouponPackRow;
  const now = new Date().toISOString();
  const amount = Math.max(1, Number(pack.discount_applied ?? pack.unit_amount));

  const { data: existingRedeem } = await supabaseAdmin
    .from("coupon_ledger")
    .select("id")
    .eq("pack_id", pack.id)
    .eq("type", "REDEEM")
    .eq("booking_id", bookingId)
    .eq("status", "CONFIRMED")
    .maybeSingle();
  if (existingRedeem) return;

  const { error: updateErr } = await supabaseAdmin
    .from("member_coupon_packs")
    .update({
      status: "REDEEMED",
      redeemed_booking_id: bookingId,
      updated_at: now,
    })
    .eq("id", pack.id)
    .eq("status", "RESERVED");

  if (updateErr) throw new Error(updateErr.message || "쿠폰 사용 확정에 실패했습니다.");

  const { error: ledgerErr } = await supabaseAdmin.from("coupon_ledger").insert({
    user_id: userId,
    pack_id: pack.id,
    type: "REDEEM",
    status: "CONFIRMED",
    amount,
    reason: `${COUPON_PACKS[pack.tier].reason} 사용`,
    ref_type: "BOOKING_DEPOSIT",
    ref_id: bookingId,
    booking_id: bookingId,
    created_at: now,
  });

  if (ledgerErr) throw new Error(ledgerErr.message || "쿠폰 사용 원장 기록에 실패했습니다.");
}
