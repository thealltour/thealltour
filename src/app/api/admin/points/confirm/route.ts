import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = { ledgerId: string };

/** 관리자: pending EARN을 CONFIRMED로 전환 — point_balance 증가, point_pending 감소 */
export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const ledgerId = body.ledgerId?.trim();
  if (!ledgerId) {
    return NextResponse.json({ message: "ledgerId는 필수입니다." }, { status: 400 });
  }

  const { data: ledger, error: fetchErr } = await supabaseAdmin
    .from("point_ledger")
    .select("id, user_id, type, status, amount")
    .eq("id", ledgerId)
    .maybeSingle();

  if (fetchErr || !ledger) {
    return NextResponse.json({ message: "해당 원장 기록을 찾을 수 없습니다." }, { status: 404 });
  }

  const row = ledger as { type: string; status: string; user_id: string; amount: number };
  if (row.type !== "EARN" || row.status !== "PENDING") {
    return NextResponse.json({ message: "확정할 수 있는 대기 적립 기록이 아닙니다." }, { status: 400 });
  }

  const userId = row.user_id;
  const amount = Number(row.amount);

  const { error: ledgerUpdateErr } = await supabaseAdmin
    .from("point_ledger")
    .update({ status: "CONFIRMED" })
    .eq("id", ledgerId);

  if (ledgerUpdateErr) {
    return NextResponse.json({ message: "원장 상태 변경에 실패했습니다." }, { status: 500 });
  }

  const { data: memberRow } = await supabaseAdmin
    .from("members")
    .select("point_balance, point_pending")
    .eq("id", userId)
    .maybeSingle();

  if (!memberRow) {
    return NextResponse.json({ message: "회원 정보를 찾을 수 없습니다." }, { status: 500 });
  }

  const balance = Number((memberRow as { point_balance?: number }).point_balance ?? 0);
  const pending = Number((memberRow as { point_pending?: number }).point_pending ?? 0);
  if (pending < amount) {
    return NextResponse.json({ message: "대기 포인트가 부족합니다. 데이터를 확인해 주세요." }, { status: 400 });
  }

  const { error: memberUpdateErr } = await supabaseAdmin
    .from("members")
    .update({
      point_balance: balance + amount,
      point_pending: pending - amount,
    })
    .eq("id", userId);

  if (memberUpdateErr) {
    return NextResponse.json({ message: "포인트 확정 반영에 실패했습니다." }, { status: 500 });
  }

  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    type: "POINT_EARNED",
    title: "포인트 확정",
    body: `${amount}P가 확정되어 잔액에 반영되었습니다.`,
  });

  return NextResponse.json({ message: "포인트가 확정되었습니다." });
}
