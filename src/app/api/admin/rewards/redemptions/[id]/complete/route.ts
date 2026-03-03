import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

/** 관리자: 완료 처리 — status=COMPLETED */
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
    .select("id, status, user_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ message: "해당 교환 신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const r = row as { status: string };
  if (r.status !== "SHIPPED" && r.status !== "APPROVED") {
    return NextResponse.json({ message: "발송된 신청만 완료 처리할 수 있습니다." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("reward_redemptions")
    .update({
      status: "COMPLETED",
      completed_at: now,
      admin_memo: body.admin_memo?.trim() || null,
      updated_at: now,
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ message: "완료 처리에 실패했습니다." }, { status: 500 });
  }

  const userId = (row as { user_id: string }).user_id;
  await supabase.from("notifications").insert({
    user_id: userId,
    type: "REWARD_STATUS",
    title: "수령 완료",
    body: "경품 수령이 완료 처리되었습니다.",
  });

  return NextResponse.json({ message: "완료 처리되었습니다." });
}
