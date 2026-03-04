import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";
import { grantPointsToUser } from "@/server/services/points/grantPoints";
import { EARN_REQUEST_MESSAGE_TEMPLATES } from "@/server/services/points/earnRequests";

type Body = {
  amount: number;
  grant_status: "CONFIRMED" | "PENDING";
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

  const amount = Number(body.amount);
  const grantStatus = body.grant_status === "PENDING" ? "PENDING" : "CONFIRMED";
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: "amount는 1 이상의 숫자여야 합니다." }, { status: 400 });
  }

  const { data: earnReq, error: reqErr } = await supabase
    .from("point_earn_requests")
    .select("id, user_id, booking_ref, status")
    .eq("id", id)
    .maybeSingle();

  if (reqErr || !earnReq) {
    return NextResponse.json({ message: "요청을 찾을 수 없습니다." }, { status: 404 });
  }

  const row = earnReq as { id: string; user_id: string; booking_ref: string; status: string };
  if (row.status !== "REQUESTED") {
    return NextResponse.json({ message: "요청 상태가 REQUESTED가 아닙니다." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("point_earn_requests")
    .update({
      status: "APPROVED",
      admin_memo: body.admin_memo?.trim() || null,
      decided_at: now,
      decided_by_admin_id: "ADMIN",
    })
    .eq("id", id)
    .eq("status", "REQUESTED");

  if (updateErr) {
    return NextResponse.json({ message: "요청 승인 상태 반영에 실패했습니다." }, { status: 500 });
  }

  try {
    await grantPointsToUser({
      userId: row.user_id,
      amount,
      status: grantStatus,
      reason: `예약 적립 요청 승인 (${row.booking_ref})`,
      refType: "EARN_REQUEST",
      refId: row.id,
      actorAdminId: "ADMIN",
    });

    const bodyText =
      grantStatus === "CONFIRMED"
        ? EARN_REQUEST_MESSAGE_TEMPLATES.approved(amount)
        : EARN_REQUEST_MESSAGE_TEMPLATES.pending(amount);
    await supabase.from("notifications").insert({
      user_id: row.user_id,
      type: "ADMIN_MESSAGE",
      title: "예약 적립 요청 승인",
      body: bodyText,
    });

    return NextResponse.json({ message: "요청을 승인하고 포인트를 지급했습니다." });
  } catch (error) {
    await supabase
      .from("point_earn_requests")
      .update({
        status: "REQUESTED",
        admin_memo: null,
        decided_at: null,
        decided_by_admin_id: null,
      })
      .eq("id", id);

    const message = error instanceof Error ? error.message : "승인 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
