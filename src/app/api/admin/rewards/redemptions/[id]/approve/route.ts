import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

/** 관리자: 승인 — 재고 감소(stock not null 시), status=APPROVED, 알림 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  let body: { admin_memo?: string };
  try {
    body = (await request.json()) as { admin_memo?: string };
  } catch {
    body = {};
  }

  const { data: row, error: fetchErr } = await supabase
    .from("reward_redemptions")
    .select("id, user_id, catalog_id, point_amount, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ message: "해당 교환 신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const r = row as { status: string; catalog_id: string };
  if (r.status !== "REQUESTED") {
    return NextResponse.json({ message: "이미 처리된 신청입니다." }, { status: 400 });
  }

  const catalogId = r.catalog_id;
  const { data: catalog } = await supabase
    .from("reward_catalog")
    .select("stock")
    .eq("id", catalogId)
    .maybeSingle();

  if (catalog != null) {
    const current = (catalog as { stock: number | null }).stock;
    if (current != null) {
      if (current <= 0) {
        return NextResponse.json({ message: "재고가 없습니다." }, { status: 400 });
      }
      await supabase
        .from("reward_catalog")
        .update({ stock: current - 1, updated_at: new Date().toISOString() })
        .eq("id", catalogId);
    }
  }

  const { error: updateErr } = await supabase
    .from("reward_redemptions")
    .update({
      status: "APPROVED",
      decided_at: new Date().toISOString(),
      admin_memo: body.admin_memo?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ message: "승인 처리에 실패했습니다." }, { status: 500 });
  }

  const userId = (row as { user_id: string }).user_id;
  await supabase.from("notifications").insert({
    user_id: userId,
    type: "REWARD_STATUS",
    title: "교환 승인",
    body: "경품 교환이 승인되었습니다. 발송 예정입니다.",
  });

  return NextResponse.json({ message: "승인되었습니다." });
}
