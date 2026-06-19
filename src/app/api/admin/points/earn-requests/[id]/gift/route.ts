import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { EARN_REQUEST_MESSAGE_TEMPLATES } from "@/server/services/points/earnRequests";
import type { PointEarnRequestGiftStatus } from "@/types/pointsRewardsV2";

type Body = {
  gift_status: "SHIPPED" | "COMPLETED";
  admin_memo?: string;
};

type GiftRpcResult = {
  request_id: string;
  user_id: string;
  gift_status: PointEarnRequestGiftStatus;
  traveler_count: number;
  booking_ref: string;
};

function mapGiftRpcError(message: string): string {
  if (message.includes("REQUEST_NOT_FOUND")) return "요청을 찾을 수 없습니다.";
  if (message.includes("INVALID_REQUEST_STATUS")) return "승인된 요청만 배송 처리할 수 있습니다.";
  if (message.includes("INVALID_GIFT_STATUS")) return "유효하지 않은 배송 상태입니다.";
  if (message.includes("INVALID_GIFT_TRANSITION")) return "현재 배송 상태에서 해당 처리를 할 수 없습니다.";
  return "배송 상태 변경에 실패했습니다.";
}

/** 관리자: 골프공 배송 상태 변경 (PENDING→SHIPPED→COMPLETED) */
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

  if (body.gift_status !== "SHIPPED" && body.gift_status !== "COMPLETED") {
    return NextResponse.json({ message: "gift_status는 SHIPPED 또는 COMPLETED여야 합니다." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("update_point_earn_request_gift_status", {
    p_request_id: id,
    p_gift_status: body.gift_status,
    p_admin_memo: body.admin_memo?.trim() || null,
  });

  if (error) {
    const message = mapGiftRpcError(error.message);
    const status = error.message.includes("REQUEST_NOT_FOUND") ? 404 : 400;
    return NextResponse.json({ message }, { status });
  }

  const result = data as GiftRpcResult;
  const travelerCount = Number(result.traveler_count);

  const notification =
    body.gift_status === "SHIPPED"
      ? {
          title: "골프공 발송",
          body: EARN_REQUEST_MESSAGE_TEMPLATES.giftShipped(travelerCount),
        }
      : {
          title: "골프공 배송 완료",
          body: EARN_REQUEST_MESSAGE_TEMPLATES.giftCompleted(travelerCount),
        };

  try {
    await supabaseAdmin.from("notifications").insert({
      user_id: result.user_id,
      type: "REWARD_STATUS",
      title: notification.title,
      body: notification.body,
    });
  } catch {
    // best-effort
  }

  return NextResponse.json({
    message: body.gift_status === "SHIPPED" ? "발송 처리되었습니다." : "배송 완료 처리되었습니다.",
    gift_status: result.gift_status,
    traveler_count: travelerCount,
  });
}
