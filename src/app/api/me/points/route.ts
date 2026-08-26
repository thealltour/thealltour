import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { memberHasConfirmedBooking } from "@/lib/bookings/memberHasConfirmedBooking";
import { DISCOUNT_RATES } from "@/lib/payments/calculatePaxDiscount";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PointLedgerRow } from "@/types/pointsRewardsV2";

const LEDGER_PAGE_SIZE = 50;
const EXPIRING_DAYS = 30;

export async function GET() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      balance: 0,
      pending: 0,
      expiringSoon: 0,
      ledger: [],
      hasPreviousBooking: false,
      discountTier: "WELCOME",
      unitDiscount: DISCOUNT_RATES.WELCOME,
    });
  }

  const userId = session.memberId;

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
    const discountTier = hasPreviousBooking ? "RETURNING" : "WELCOME";
    const unitDiscount = DISCOUNT_RATES[discountTier];
    return NextResponse.json({
      authenticated: true,
      balance: 0,
      pending: 0,
      expiringSoon: 0,
      ledger: [],
      hasPreviousBooking,
      discountTier,
      unitDiscount,
    });
  }
  if (ledgerRes.error) {
    console.error("[GET /api/me/points] point_ledger 조회 실패", {
      userId,
      error: ledgerRes.error.message,
    });
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
  const expiringSoon = (expiringRes.data ?? []).reduce(
    (sum, r) => sum + Number((r as { amount: number }).amount),
    0,
  );
  const discountTier = hasPreviousBooking ? "RETURNING" : "WELCOME";
  const unitDiscount = DISCOUNT_RATES[discountTier];

  return NextResponse.json({
    authenticated: true,
    balance,
    pending,
    expiringSoon,
    ledger,
    hasPreviousBooking,
    discountTier,
    unitDiscount,
  });
}
