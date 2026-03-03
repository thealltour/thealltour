import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import type { MemberPointSummary } from "@/types/pointsRewards";

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
    supabase.from("members").select("points").eq("id", memberId).maybeSingle(),
    supabase
      .from("point_ledger")
      .select("*")
      .eq("member_id", memberId)
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

  const pointBalance = Number((memberRes.data as { points?: number }).points ?? 0);
  const ledgerRows = (ledgerRes.data ?? []) as MemberPointSummary["ledgerRecent"];
  const pendingItems = (pendingRes.data ?? []) as MemberPointSummary["pendingItems"];
  const pendingTotal = pendingItems.reduce((sum, p) => sum + Number(p.amount), 0);

  const summary: MemberPointSummary = {
    pointBalance,
    pendingTotal,
    ledgerRecent: ledgerRows,
    pendingItems,
  };

  return NextResponse.json(summary);
}
