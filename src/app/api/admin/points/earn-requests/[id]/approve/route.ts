import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getPointExpiresAt } from "@/config/rewardPolicy";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { EARN_REQUEST_MESSAGE_TEMPLATES } from "@/server/services/points/earnRequests";

type Body = {
  admin_memo?: string;
};

type ApproveRpcResult = {
  ledger_id: string;
  amount: number;
  user_id: string;
  booking_ref: string;
  traveler_count: number;
  gift_status: string;
};

function mapApproveRpcError(message: string): string {
  if (message.includes("REQUEST_NOT_FOUND")) return "요청을 찾을 수 없습니다.";
  if (message.includes("INVALID_STATUS")) return "요청 상태가 REQUESTED가 아닙니다.";
  if (message.includes("INVALID_TRAVELER_COUNT")) return "여행 인원수가 올바르지 않습니다.";
  if (message.includes("MEMBER_NOT_FOUND")) return "회원을 찾을 수 없습니다.";
  return "승인 처리 중 오류가 발생했습니다.";
}

/** 관리자: 승인 — traveler_count*20000P 자동 계산, RPC 원자적 처리 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;
  const { id } = await context.params;

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const { data, error } = await supabaseAdmin.rpc("approve_point_earn_request", {
    p_request_id: id,
    p_admin_memo: body.admin_memo?.trim() || null,
    p_expires_at: getPointExpiresAt(),
    p_decided_by: "ADMIN",
  });

  if (error) {
    const message = mapApproveRpcError(error.message);
    const status = error.message.includes("REQUEST_NOT_FOUND") ? 404 : 400;
    return NextResponse.json({ message }, { status });
  }

  const result = data as ApproveRpcResult;
  const amount = Number(result.amount);
  const travelerCount = Number(result.traveler_count);

  try {
    await supabaseAdmin.from("notifications").insert({
      user_id: result.user_id,
      type: "ADMIN_MESSAGE",
      title: "예약 적립 요청 승인",
      body: EARN_REQUEST_MESSAGE_TEMPLATES.approved(amount, travelerCount),
    });
  } catch {
    // RPC commit 후 알림 실패는 best-effort
  }

  return NextResponse.json({
    message: "요청을 승인하고 포인트를 지급했습니다.",
    amount,
    traveler_count: travelerCount,
    gift_status: result.gift_status ?? "PENDING",
    ledger_id: result.ledger_id,
  });
}
