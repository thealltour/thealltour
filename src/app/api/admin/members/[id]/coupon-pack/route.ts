import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { memberHasConfirmedBooking } from "@/lib/bookings/memberHasConfirmedBooking";
import { COUPON_PACKS, recommendCouponPackTier } from "@/lib/coupons/couponPacks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** 관리자: 회원 쿠폰팩 보유·권장 티어 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: memberId } = await context.params;
  if (!memberId?.trim()) {
    return NextResponse.json({ message: "회원 ID가 필요합니다." }, { status: 400 });
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("id")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) {
    return NextResponse.json({ message: "회원 정보를 불러오지 못했습니다." }, { status: 500 });
  }
  if (!member) {
    return NextResponse.json({ message: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  const [hasConfirmedBooking, packsRes, ledgerRes] = await Promise.all([
    memberHasConfirmedBooking(memberId),
    supabaseAdmin
      .from("member_coupon_packs")
      .select("id, tier, unit_amount, status, source_ref_type, created_at")
      .eq("user_id", memberId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("coupon_ledger")
      .select("id, type, status, amount, reason, ref_type, pack_id, booking_id, created_at")
      .eq("user_id", memberId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (packsRes.error) {
    return NextResponse.json({ message: "쿠폰팩을 불러오지 못했습니다." }, { status: 500 });
  }

  const packs = packsRes.data ?? [];
  const hasWelcomePack = packs.some(
    (p) => p.tier === "WELCOME" && ["AVAILABLE", "RESERVED"].includes(String(p.status)),
  );
  const hasReturningPack = packs.some(
    (p) => p.tier === "RETURNING" && ["AVAILABLE", "RESERVED"].includes(String(p.status)),
  );
  const recommendedTier = recommendCouponPackTier(hasConfirmedBooking);

  return NextResponse.json({
    recommendedTier,
    hasConfirmedBooking,
    hasWelcomePack,
    hasReturningPack,
    packs,
    ledger: ledgerRes.data ?? [],
    packDefs: {
      WELCOME: COUPON_PACKS.WELCOME,
      RETURNING: COUPON_PACKS.RETURNING,
    },
  });
}
