import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** 관리자: 교환 승인 — reward_redemptions 기준, point_ledger USE(양수) + 잔액 차감 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: redemptionId } = await context.params;
  const body = (await request.json()).catch(() => ({})) as { admin_memo?: string; admin_note?: string };
  const adminMemo = body.admin_memo?.trim() ?? body.admin_note?.trim() ?? null;

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from("reward_redemptions")
    .select("id, user_id, catalog_id, point_amount, status")
    .eq("id", redemptionId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ message: "해당 교환 신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const r = row as { status: string; user_id: string; point_amount: number; catalog_id: string };
  if (r.status !== "REQUESTED") {
    return NextResponse.json({ message: "이미 처리된 신청입니다." }, { status: 400 });
  }

  const userId = r.user_id;
  const pointAmount = Number(r.point_amount);
  const catalogId = r.catalog_id;

  const { data: memberRow } = await supabaseAdmin
    .from("members")
    .select("point_balance, points")
    .eq("id", userId)
    .maybeSingle();

  const member = memberRow as { point_balance?: number; points?: number } | null;
  const currentPoints = Number(member?.point_balance ?? member?.points ?? 0);
  if (currentPoints < pointAmount) {
    return NextResponse.json(
      { message: `회원 보유 포인트가 부족합니다. (필요: ${pointAmount}, 보유: ${currentPoints})` },
      { status: 400 },
    );
  }

  const newBalance = currentPoints - pointAmount;

  const { data: ledgerRow, error: ledgerErr } = await supabaseAdmin
    .from("point_ledger")
    .insert({
      user_id: userId,
      type: "USE",
      status: "CONFIRMED",
      amount: pointAmount,
      reason: "경품 교환",
      ref_type: "REDEMPTION",
      ref_id: redemptionId,
    })
    .select("id")
    .maybeSingle();

  if (ledgerErr || !ledgerRow) {
    return NextResponse.json({ message: "포인트 원장 기록에 실패했습니다." }, { status: 500 });
  }

  const updateMemberPayload: { point_balance?: number; points?: number } = {};
  if (member && "point_balance" in member && member.point_balance !== undefined) {
    updateMemberPayload.point_balance = newBalance;
  } else {
    updateMemberPayload.points = newBalance;
  }

  const { error: updateMemberErr } = await supabaseAdmin
    .from("members")
    .update(updateMemberPayload)
    .eq("id", userId);

  if (updateMemberErr) {
    return NextResponse.json({ message: "회원 포인트 차감에 실패했습니다." }, { status: 500 });
  }

  const { error: updateRedemptionErr } = await supabaseAdmin
    .from("reward_redemptions")
    .update({
      status: "APPROVED",
      decided_at: new Date().toISOString(),
      admin_memo: adminMemo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", redemptionId);

  if (updateRedemptionErr) {
    return NextResponse.json({ message: "교환 상태 업데이트에 실패했습니다." }, { status: 500 });
  }

  const { data: catalog } = await supabaseAdmin
    .from("reward_catalog")
    .select("stock, stock_count")
    .eq("id", catalogId)
    .maybeSingle();

  if (catalog != null) {
    const c = catalog as { stock?: number | null; stock_count?: number };
    const current = c.stock ?? c.stock_count;
    if (typeof current === "number" && current > 0) {
      const nextStock = current - 1;
      const payload: Record<string, string | number> = { updated_at: new Date().toISOString() };
      if (c.stock != null) payload.stock = nextStock;
      if (c.stock_count != null) payload.stock_count = nextStock;
      await supabaseAdmin.from("reward_catalog").update(payload).eq("id", catalogId);
    }
  }

  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    type: "REWARD_STATUS",
    title: "교환 승인",
    body: "경품 교환이 승인되었습니다. 포인트가 차감되었습니다.",
  });

  return NextResponse.json({ message: "승인되었습니다. 포인트가 차감되었습니다." });
}
