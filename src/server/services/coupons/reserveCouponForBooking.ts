import "server-only";

import { COUPON_PACKS } from "@/lib/coupons/couponPacks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CouponPackTier, MemberCouponPackRow } from "@/types/coupons";

export async function findAvailableCouponPack(params: {
  userId: string;
  preferredTier?: CouponPackTier;
}): Promise<MemberCouponPackRow | null> {
  const userId = params.userId.trim();
  if (!userId) return null;

  const { data: rows, error } = await supabaseAdmin
    .from("member_coupon_packs")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "AVAILABLE")
    .order("created_at", { ascending: true })
    .limit(20);

  if (error || !rows?.length) return null;

  const packs = rows as MemberCouponPackRow[];
  const preferred = params.preferredTier;
  if (preferred) {
    const match = packs.find((p) => p.tier === preferred);
    if (match) return match;
  }
  return packs[0] ?? null;
}

export async function reserveCouponForBooking(params: {
  userId: string;
  bookingId: string;
  packId: string;
  discountAmount: number;
  travelerCount: number;
}): Promise<{ ok: true; pack: MemberCouponPackRow } | { ok: false; reason: string }> {
  const discountAmount = Math.floor(params.discountAmount);
  if (discountAmount <= 0) {
    return { ok: false, reason: "할인 금액이 없습니다." };
  }

  const now = new Date().toISOString();

  const { data: updated, error } = await supabaseAdmin
    .from("member_coupon_packs")
    .update({
      status: "RESERVED",
      reserved_booking_id: params.bookingId,
      discount_applied: discountAmount,
      traveler_count: params.travelerCount,
      updated_at: now,
    })
    .eq("id", params.packId)
    .eq("user_id", params.userId)
    .eq("status", "AVAILABLE")
    .select("*")
    .maybeSingle();

  if (error) {
    return { ok: false, reason: error.message };
  }
  if (!updated) {
    return { ok: false, reason: "사용 가능한 쿠폰팩이 없습니다." };
  }

  const pack = updated as MemberCouponPackRow;
  const { error: ledgerErr } = await supabaseAdmin.from("coupon_ledger").insert({
    user_id: params.userId,
    pack_id: pack.id,
    type: "RESERVE",
    status: "CONFIRMED",
    amount: discountAmount,
    reason: `${COUPON_PACKS[pack.tier].reason} 예약`,
    ref_type: "BOOKING_DEPOSIT",
    ref_id: params.bookingId,
    booking_id: params.bookingId,
    created_at: now,
  });

  if (ledgerErr) {
    await supabaseAdmin
      .from("member_coupon_packs")
      .update({
        status: "AVAILABLE",
        reserved_booking_id: null,
        discount_applied: null,
        traveler_count: null,
        updated_at: now,
      })
      .eq("id", pack.id);
    return { ok: false, reason: ledgerErr.message };
  }

  return { ok: true, pack };
}
