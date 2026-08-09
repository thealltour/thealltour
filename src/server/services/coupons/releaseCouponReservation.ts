import "server-only";

import { COUPON_PACKS } from "@/lib/coupons/couponPacks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { MemberCouponPackRow } from "@/types/coupons";

/** 예약 취소·결제 실패 시 RESERVED 쿠폰을 AVAILABLE로 복구 */
export async function releaseCouponReservation(params: {
  userId?: string | null;
  bookingId: string;
  packId?: string | null;
}): Promise<void> {
  const bookingId = params.bookingId.trim();
  if (!bookingId) return;

  let query = supabaseAdmin
    .from("member_coupon_packs")
    .select("*")
    .eq("status", "RESERVED")
    .eq("reserved_booking_id", bookingId);

  if (params.userId) query = query.eq("user_id", params.userId);
  if (params.packId) query = query.eq("id", params.packId);

  const { data: packRow } = await query.maybeSingle();
  if (!packRow) return;

  const pack = packRow as MemberCouponPackRow;
  const now = new Date().toISOString();
  const amount = Math.max(1, Number(pack.discount_applied ?? pack.unit_amount));

  const { error: updateErr } = await supabaseAdmin
    .from("member_coupon_packs")
    .update({
      status: "AVAILABLE",
      reserved_booking_id: null,
      discount_applied: null,
      traveler_count: null,
      updated_at: now,
    })
    .eq("id", pack.id)
    .eq("status", "RESERVED");

  if (updateErr) throw new Error(updateErr.message || "쿠폰 예약 해제에 실패했습니다.");

  await supabaseAdmin.from("coupon_ledger").insert({
    user_id: pack.user_id,
    pack_id: pack.id,
    type: "RELEASE",
    status: "CONFIRMED",
    amount,
    reason: `${COUPON_PACKS[pack.tier].reason} 예약 해제`,
    ref_type: "BOOKING_DEPOSIT",
    ref_id: bookingId,
    booking_id: bookingId,
    created_at: now,
  });
}
