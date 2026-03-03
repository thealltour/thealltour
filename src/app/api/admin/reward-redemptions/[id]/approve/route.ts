import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/** 관리자: 교환 승인 → 포인트 차감 + 원장 기록 + 재고 차감 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: redemptionId } = await context.params;
  const body = (await request.json()).catch(() => ({})) as { admin_note?: string };
  const adminNote = body.admin_note?.trim() ?? null;

  const { data: row, error: fetchErr } = await supabase
    .from("reward_redemption")
    .select("id,member_id,reward_catalog_id,point_amount,status")
    .eq("id", redemptionId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ message: "해당 교환 신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const r = row as { status: string; member_id: string; point_amount: number; reward_catalog_id: string };
  if (r.status !== "requested") {
    return NextResponse.json({ message: "이미 처리된 신청입니다." }, { status: 400 });
  }

  const memberId = r.member_id;
  const pointAmount = Number(r.point_amount);
  const catalogId = r.reward_catalog_id;

  const { data: memberRow } = await supabase.from("members").select("points").eq("id", memberId).maybeSingle();
  const currentPoints = Number((memberRow as { points?: number } | null)?.points ?? 0);
  if (currentPoints < pointAmount) {
    return NextResponse.json(
      { message: `회원 보유 포인트가 부족합니다. (필요: ${pointAmount}, 보유: ${currentPoints})` },
      { status: 400 },
    );
  }

  const newBalance = currentPoints - pointAmount;

  const { data: ledgerRow, error: ledgerErr } = await supabase
    .from("point_ledger")
    .insert({
      member_id: memberId,
      kind: "deduction",
      amount: -pointAmount,
      balance_after: newBalance,
      reason: "경품 교환",
      reference_type: "redemption",
      reference_id: redemptionId,
    })
    .select("id")
    .maybeSingle();

  if (ledgerErr || !ledgerRow) {
    return NextResponse.json({ message: "포인트 원장 기록에 실패했습니다." }, { status: 500 });
  }

  const ledgerId = (ledgerRow as { id: string }).id;

  const { error: updateMemberErr } = await supabase
    .from("members")
    .update({ points: newBalance })
    .eq("id", memberId);

  if (updateMemberErr) {
    return NextResponse.json({ message: "회원 포인트 차감에 실패했습니다." }, { status: 500 });
  }

  const { error: updateRedemptionErr } = await supabase
    .from("reward_redemption")
    .update({
      status: "approved",
      admin_note: adminNote,
      processed_at: new Date().toISOString(),
      ledger_id: ledgerId,
    })
    .eq("id", redemptionId);

  if (updateRedemptionErr) {
    return NextResponse.json({ message: "교환 상태 업데이트에 실패했습니다." }, { status: 500 });
  }

  const { data: catalog } = await supabase.from("reward_catalog").select("stock_count").eq("id", catalogId).maybeSingle();
  if (catalog != null) {
    const nextStock = Math.max(0, Number((catalog as { stock_count: number }).stock_count) - 1);
    await supabase.from("reward_catalog").update({ stock_count: nextStock }).eq("id", catalogId);
  }

  return NextResponse.json({ message: "승인되었습니다. 포인트가 차감되었습니다." });
}
