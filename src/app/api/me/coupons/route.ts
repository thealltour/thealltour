import { NextResponse } from "next/server";
import { requireMemberSession } from "@/lib/apiAuth";
import { COUPON_PACKS } from "@/lib/coupons/couponPacks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** 회원: 보유 쿠폰팩 + 최근 쿠폰 원장 */
export async function GET() {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;

  const userId = auth.session.memberId;

  const [packsRes, ledgerRes] = await Promise.all([
    supabaseAdmin
      .from("member_coupon_packs")
      .select("id, tier, unit_amount, status, source_ref_type, discount_applied, traveler_count, created_at, redeemed_booking_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("coupon_ledger")
      .select("id, type, status, amount, reason, pack_id, booking_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (packsRes.error) {
    return NextResponse.json({ message: "쿠폰 정보를 불러오지 못했습니다." }, { status: 500 });
  }

  const packs = packsRes.data ?? [];
  const available = packs.filter((p) => p.status === "AVAILABLE");
  const heldNames = [
    ...new Set(
      available.map((p) =>
        p.tier === "RETURNING" ? COUPON_PACKS.RETURNING.reason : COUPON_PACKS.WELCOME.reason,
      ),
    ),
  ];

  return NextResponse.json({
    packs,
    availableCount: available.length,
    heldNames,
    ledger: ledgerRes.data ?? [],
  });
}
