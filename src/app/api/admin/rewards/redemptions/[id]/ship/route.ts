import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** 관리자: 발송 처리 — tracking 저장, status=SHIPPED, 알림(운송장 포함) */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  let body: { tracking_carrier?: string; tracking_number?: string; admin_memo?: string };
  try {
    body = (await request.json()) as { tracking_carrier?: string; tracking_number?: string; admin_memo?: string };
  } catch {
    body = {};
  }

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from("reward_redemptions")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ message: "해당 교환 신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const r = row as { status: string; user_id: string };
  if (r.status !== "APPROVED" && r.status !== "REQUESTED") {
    return NextResponse.json({ message: "승인된 신청만 발송 처리할 수 있습니다." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabaseAdmin
    .from("reward_redemptions")
    .update({
      status: "SHIPPED",
      shipped_at: now,
      tracking_carrier: body.tracking_carrier?.trim() || null,
      tracking_number: body.tracking_number?.trim() || null,
      admin_memo: body.admin_memo?.trim() || null,
      updated_at: now,
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ message: "발송 처리에 실패했습니다." }, { status: 500 });
  }

  const carrier = body.tracking_carrier?.trim() || "";
  const number = body.tracking_number?.trim() || "";
  const trackingText = carrier && number ? ` (${carrier}: ${number})` : number ? ` (${number})` : "";
  await supabaseAdmin.from("notifications").insert({
    user_id: r.user_id,
    type: "REWARD_STATUS",
    title: "발송 완료",
    body: `경품이 발송되었습니다.${trackingText}`,
  });

  return NextResponse.json({ message: "발송 처리되었습니다." });
}
