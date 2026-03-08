import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/** 관리자: 포인트 수동 지급 (원장 기록 포함) */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: memberId } = await context.params;
  const body = (await request.json()).catch(() => ({})) as { amount?: number; reason?: string };
  const amount = Number(body.amount);
  const reason = body.reason?.trim() || "관리자 지급";

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: "지급 포인트는 1 이상의 숫자로 입력해 주세요." }, { status: 400 });
  }

  const { data: memberRow } = await supabase.from("members").select("points").eq("id", memberId).maybeSingle();
  if (!memberRow) {
    return NextResponse.json({ message: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  const currentPoints = Number((memberRow as { points?: number }).points ?? 0);
  const newBalance = currentPoints + amount;

  const { data: ledgerRow, error: ledgerErr } = await supabase
    .from("point_ledger")
    .insert({
      user_id: memberId,
      type: "EARN",
      status: "CONFIRMED",
      amount,
      reason,
      ref_type: "manual",
      ref_id: null,
    })
    .select("id")
    .maybeSingle();

  if (ledgerErr || !ledgerRow) {
    return NextResponse.json({ message: "포인트 원장 기록에 실패했습니다." }, { status: 500 });
  }

  const { error: updateErr } = await supabase.from("members").update({ points: newBalance }).eq("id", memberId);
  if (updateErr) {
    return NextResponse.json({ message: "회원 포인트 반영에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ message: `${amount}P 지급되었습니다. (잔액: ${newBalance}P)` });
}
