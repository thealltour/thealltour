import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";
import { getPointExpiresAt } from "@/config/rewardPolicy";

type Body = {
  userId: string;
  amount: number;
  reason: string;
  refType?: string;
  refId?: string;
  status?: "CONFIRMED" | "PENDING";
};

/** 관리자: 포인트 수동 지급 — ledger EARN, balance 또는 pending 반영, 알림 */
export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const userId = body.userId?.trim();
  const amount = Number(body.amount);
  const reason = body.reason?.trim() || "관리자 지급";
  const status = body.status === "PENDING" ? "PENDING" : "CONFIRMED";

  if (!userId) {
    return NextResponse.json({ message: "userId는 필수입니다." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: "amount는 1 이상의 숫자여야 합니다." }, { status: 400 });
  }

  const { data: memberRow, error: memberErr } = await supabase
    .from("members")
    .select("id, point_balance, point_pending")
    .eq("id", userId)
    .maybeSingle();

  if (memberErr || !memberRow) {
    return NextResponse.json({ message: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  const currentBalance = Number((memberRow as { point_balance?: number }).point_balance ?? 0);
  const currentPending = Number((memberRow as { point_pending?: number }).point_pending ?? 0);

  const { data: ledgerRow, error: ledgerErr } = await supabase
    .from("point_ledger")
    .insert({
      user_id: userId,
      type: "EARN",
      status,
      amount,
      reason,
      ref_type: body.refType?.trim() || null,
      ref_id: body.refId?.trim() || null,
      expires_at: getPointExpiresAt(),
    })
    .select("id")
    .maybeSingle();

  if (ledgerErr || !ledgerRow) {
    return NextResponse.json({ message: "포인트 원장 기록에 실패했습니다." }, { status: 500 });
  }

  if (status === "CONFIRMED") {
    const { error: updateErr } = await supabase
      .from("members")
      .update({ point_balance: currentBalance + amount })
      .eq("id", userId);
    if (updateErr) {
      return NextResponse.json({ message: "포인트 반영에 실패했습니다." }, { status: 500 });
    }
  } else {
    const { error: updateErr } = await supabase
      .from("members")
      .update({ point_pending: currentPending + amount })
      .eq("id", userId);
    if (updateErr) {
      return NextResponse.json({ message: "대기 포인트 반영에 실패했습니다." }, { status: 500 });
    }
  }

  await supabase.from("notifications").insert({
    user_id: userId,
    type: "POINT_EARNED",
    title: "포인트 적립",
    body: status === "CONFIRMED" ? `${amount}P가 적립되었습니다.` : `${amount}P가 적립 예정입니다. (확정 후 반영됩니다.)`,
  });

  return NextResponse.json({
    message: status === "CONFIRMED" ? `${amount}P 지급되었습니다.` : `${amount}P가 대기 상태로 기록되었습니다.`,
    ledgerId: (ledgerRow as { id: string }).id,
  });
}
