/**
 * PR13: 관리자 단일 리마인더 취소/재발송.
 */
import { NextResponse } from "next/server";
import {
  getReviewReminderById,
  cancelReminderById,
  executeReminderSend,
} from "@/lib/reviewReminders";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as { action?: string };
  const action = body.action === "cancel" ? "cancel" : null;

  if (action === "cancel") {
    const ok = await cancelReminderById(id);
    if (!ok) {
      return NextResponse.json(
        { message: "취소할 수 없습니다. 이미 발송되었거나 취소된 건입니다." },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "취소되었습니다." });
  }

  return NextResponse.json({ message: "action은 cancel 만 지원합니다." }, { status: 400 });
}

/** 재발송: 즉시 발송 처리 후 sent 로 표시 */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const reminder = await getReviewReminderById(id);
  if (!reminder) {
    return NextResponse.json({ message: "리마인더를 찾을 수 없습니다." }, { status: 404 });
  }
  if (reminder.status !== "scheduled") {
    return NextResponse.json(
      { message: "예약된(scheduled) 건만 재발송할 수 있습니다." },
      { status: 400 },
    );
  }

  const ok = await executeReminderSend(id);
  if (!ok) {
    return NextResponse.json({ message: "재발송 처리에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ message: "재발송 처리되었습니다." });
}
