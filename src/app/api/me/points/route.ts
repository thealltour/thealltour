import { NextResponse } from "next/server";
import { memberHasConfirmedBooking } from "@/lib/bookings/memberHasConfirmedBooking";
import { DISCOUNT_RATES } from "@/lib/payments/calculatePaxDiscount";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMemberSession } from "@/lib/apiAuth";
import type { PointLedgerRow } from "@/types/pointsRewardsV2";

const LEDGER_PAGE_SIZE = 50;
const EXPIRING_DAYS = 30;

export async function GET() {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;
  const userId = auth.session.memberId;

  const [memberRes, ledgerRes, expiringRes, hasPreviousBooking] = await Promise.all([
    supabaseAdmin.from("members").select("point_balance, point_pending").eq("id", userId).maybeSingle(),
    supabaseAdmin
      .from("point_ledger")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(LEDGER_PAGE_SIZE),
    supabaseAdmin
      .from("point_ledger")
      .select("amount")
      .eq("user_id", userId)
      .eq("type", "EARN")
      .eq("status", "CONFIRMED")
      .not("expires_at", "is", null)
      .gte("expires_at", new Date().toISOString())
      .lte("expires_at", new Date(Date.now() + EXPIRING_DAYS * 24 * 60 * 60 * 1000).toISOString()),
    memberHasConfirmedBooking(userId),
  ]);

  if (memberRes.error || !memberRes.data) {
    console.error("[GET /api/me/points] members 조회 실패", {
      userId,
      error: memberRes.error?.message,
    });
    return NextResponse.json({ message: "회원 정보를 불러올 수 없습니다." }, { status: 500 });
  }
  if (ledgerRes.error) {
    console.error("[GET /api/me/points] point_ledger 조회 실패", { userId, error: ledgerRes.error.message });
  }
  if (expiringRes.error) {
    console.error("[GET /api/me/points] 만료 예정 포인트 조회 실패", {
      userId,
      error: expiringRes.error.message,
    });
  }

  const balance = Number((memberRes.data as { point_balance?: number }).point_balance ?? 0);
  const pending = Number((memberRes.data as { point_pending?: number }).point_pending ?? 0);
  const ledger = (ledgerRes.data ?? []) as PointLedgerRow[];
  const expiringSoon = (expiringRes.data ?? []).reduce((sum, r) => sum + Number((r as { amount: number }).amount), 0);
  const discountTier = hasPreviousBooking ? "RETURNING" : "WELCOME";
  const unitDiscount = DISCOUNT_RATES[discountTier];

  return NextResponse.json({
    balance,
    pending,
    expiringSoon,
    ledger,
    hasPreviousBooking,
    discountTier,
    unitDiscount,
  });
}
