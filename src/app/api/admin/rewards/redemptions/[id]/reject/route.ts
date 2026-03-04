import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

/** 관리자: 반려 — RELEASE ledger + balance 복구, status=REJECTED, 알림 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  let body: { admin_memo?: string; reason?: string };
  try {
    body = (await request.json()) as { admin_memo?: string; reason?: string };
  } catch {
    body = {};
  }

  const { data: row, error: fetchErr } = await supabase
    .from("reward_redemptions")
    .select("id, user_id, point_amount, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ message: "해당 교환 신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const r = row as { status: string; user_id: string; point_amount: number };
  if (r.status !== "REQUESTED") {
    return NextResponse.json({ message: "이미 처리된 신청입니다." }, { status: 400 });
  }

  const userId = r.user_id;
  const amount = Number(r.point_amount);

  const { error: ledgerErr } = await supabase.from("point_ledger").insert({
    user_id: userId,
    type: "RELEASE",
    status: "CONFIRMED",
    amount,
    reason: "경품 교환 반려로 인한 포인트 복구",
    ref_type: "REWARD_REDEMPTION",
    ref_id: id,
  });

  if (ledgerErr) {
    return NextResponse.json({ message: "포인트 복구 기록에 실패했습니다." }, { status: 500 });
  }

  const { data: memberRow } = await supabase
    .from("members")
    .select("point_balance")
    .eq("id", userId)
    .maybeSingle();
  const currentBalance = Number((memberRow as { point_balance?: number } | null)?.point_balance ?? 0);
  const { error: updateMemberErr } = await supabase
    .from("members")
    .update({ point_balance: currentBalance + amount })
    .eq("id", userId);

  if (updateMemberErr) {
    return NextResponse.json({ message: "포인트 복구에 실패했습니다." }, { status: 500 });
  }

  const { error: updateRedemptionErr } = await supabase
    .from("reward_redemptions")
    .update({
      status: "REJECTED",
      decided_at: new Date().toISOString(),
      admin_memo: body.admin_memo?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateRedemptionErr) {
    return NextResponse.json({ message: "반려 상태 업데이트에 실패했습니다." }, { status: 500 });
  }

  const reasonText = body.reason?.trim() || body.admin_memo?.trim() || "";
  await supabase.from("notifications").insert({
    user_id: userId,
    type: "REWARD_STATUS",
    title: "교환 반려",
    body: reasonText ? `경품 교환이 반려되었습니다. 사유: ${reasonText}` : "경품 교환이 반려되었습니다.",
  });

  return NextResponse.json({ message: "반려 처리되었습니다. 포인트가 복구되었습니다." });
}
