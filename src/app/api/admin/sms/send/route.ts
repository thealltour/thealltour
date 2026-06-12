import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { sendAdminSms } from "@/lib/sms/sendAdminSms";

type PostBody = {
  receiver?: string;
  message?: string;
  inquiry_id?: string | null;
  actor_name?: string | null;
};

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_JSON", message: "JSON 본문이 올바르지 않습니다.", retryable: false },
      { status: 400 },
    );
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const receiver = typeof body.receiver === "string" ? body.receiver : "";
  const inquiryId =
    typeof body.inquiry_id === "string" && body.inquiry_id.trim() ? body.inquiry_id.trim() : null;
  const actorName =
    typeof body.actor_name === "string" && body.actor_name.trim() ? body.actor_name.trim() : "관리자";

  const result = await sendAdminSms({
    receiver,
    message,
    inquiryId,
    actorName,
  });

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      logId: result.logId,
      messageLogId: result.logId,
      sentAt: result.sentAt,
    });
  }

  return NextResponse.json(
    {
      ok: false,
      code: result.relayFailureCode ?? "RELAY_FAILED",
      message: result.failureReason ?? "문자 발송에 실패했습니다.",
      failureReason: result.failureReason ?? undefined,
      logId: result.logId,
      messageLogId: result.logId,
      sentAt: result.sentAt,
      retryable: result.retryable ?? true,
    },
    { status: result.relayFailureCode === "LOG_SAVE_FAILED" ? 500 : 502 },
  );
}
