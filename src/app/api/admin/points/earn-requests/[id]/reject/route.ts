import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";
import { EARN_REQUEST_MESSAGE_TEMPLATES } from "@/server/services/points/earnRequests";

type Body = {
  reject_reason: string;
  admin_memo?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;
  const { id } = await context.params;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const rejectReason = body.reject_reason?.trim();
  if (!rejectReason) {
    return NextResponse.json({ message: "reject_reason은 필수입니다." }, { status: 400 });
  }

  const { data: earnReq, error: reqErr } = await supabase
    .from("point_earn_requests")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (reqErr || !earnReq) {
    return NextResponse.json({ message: "요청을 찾을 수 없습니다." }, { status: 404 });
  }
  if ((earnReq as { status: string }).status !== "REQUESTED") {
    return NextResponse.json({ message: "요청 상태가 REQUESTED가 아닙니다." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("point_earn_requests")
    .update({
      status: "REJECTED",
      reject_reason: rejectReason,
      admin_memo: body.admin_memo?.trim() || null,
      decided_at: now,
      decided_by_admin_id: "ADMIN",
    })
    .eq("id", id)
    .eq("status", "REQUESTED");

  if (updateErr) {
    return NextResponse.json({ message: "반려 처리에 실패했습니다." }, { status: 500 });
  }

  const userId = (earnReq as { user_id: string }).user_id;
  await supabase.from("notifications").insert({
    user_id: userId,
    type: "ADMIN_MESSAGE",
    title: "예약 적립 요청 반려",
    body: EARN_REQUEST_MESSAGE_TEMPLATES.rejected(rejectReason),
  });

  return NextResponse.json({ message: "요청이 반려 처리되었습니다." });
}
