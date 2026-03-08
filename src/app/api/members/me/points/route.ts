import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import type { PointLedgerRow } from "@/types/pointsRewardsV2";

const LEDGER_PAGE_SIZE = 30;
const PENDING_PAGE_SIZE = 20;

export async function GET() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const memberId = session.memberId;

  const [memberRes, ledgerRes, pendingRes] = await Promise.all([
    supabase.from("members").select("points, point_balance").eq("id", memberId).maybeSingle(),
    supabase
      .from("point_ledger")
      .select("id, user_id, type, status, amount, reason, ref_type, ref_id, expires_at, created_at")
      .eq("user_id", memberId)
      .order("created_at", { ascending: false })
      .limit(LEDGER_PAGE_SIZE),
    supabase
      .from("pending_points")
      .select("*")
      .eq("member_id", memberId)
      .in("status", ["pending"])
      .order("created_at", { ascending: false })
      .limit(PENDING_PAGE_SIZE),
  ]);

  if (memberRes.error || !memberRes.data) {
    return NextResponse.json({ message: "회원 정보를 불러올 수 없습니다." }, { status: 500 });
  }

  const member = memberRes.data as { points?: number; point_balance?: number };
  const pointBalance = Number(member.point_balance ?? member.points ?? 0);
  const ledgerRows = (ledgerRes.data ?? []) as PointLedgerRow[];
  const pendingItems = (pendingRes.data ?? []) as Array<{ amount: number }>;
  const pendingTotal = pendingItems.reduce((sum, p) => sum + Number(p.amount), 0);

  const summary = {
    pointBalance,
    pendingTotal,
    ledgerRecent: ledgerRows,
    pendingItems,
  };

  return NextResponse.json(summary);
}
