import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendAdminSms } from "@/lib/sms/sendAdminSms";

type PostBody = {
  message?: string;
  receiver?: string | null;
  actor_name?: string | null;
};

function summarizeRelayResponse(data: unknown): Record<string, unknown> | null {
  if (data == null) return null;
  if (typeof data !== "object" || Array.isArray(data)) {
    return { value: typeof data === "string" ? data : JSON.stringify(data).slice(0, 200) };
  }
  const o = data as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [k, v] of Object.entries(o)) {
    if (n++ >= 10) break;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) out[k] = "[…]";
    else if (Array.isArray(v)) out[k] = `[${v.length} items]`;
    else out[k] = v as unknown;
  }
  return out;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: inquiryId } = await context.params;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_JSON", message: "JSON 본문이 올바르지 않습니다.", retryable: false },
      { status: 400 },
    );
  }

  const messageRaw = typeof body.message === "string" ? body.message : "";
  const message = messageRaw.trim();
  if (!message) {
    return NextResponse.json(
      { ok: false, code: "EMPTY_MESSAGE", message: "메시지 내용을 입력해 주세요.", retryable: false },
      { status: 400 },
    );
  }

  const { data: inquiryRow, error: inquiryErr } = await supabaseAdmin
    .from("inquiries")
    .select("id, phone")
    .eq("id", inquiryId)
    .maybeSingle();

  if (inquiryErr || !inquiryRow) {
    return NextResponse.json(
      { ok: false, code: "INQUIRY_NOT_FOUND", message: "문의를 찾을 수 없습니다.", retryable: false },
      { status: 404 },
    );
  }

  const receiverInput =
    typeof body.receiver === "string" && body.receiver.trim()
      ? body.receiver.trim()
      : String(inquiryRow.phone ?? "");
  const actorName =
    typeof body.actor_name === "string" && body.actor_name.trim() ? body.actor_name.trim() : "관리자";

  const result = await sendAdminSms({
    receiver: receiverInput,
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
      relaySummary: summarizeRelayResponse(result.providerResponse),
      providerResponse: result.providerResponse ?? null,
    });
  }

  return NextResponse.json(
    {
      ok: false,
      code: result.relayFailureCode ?? "RELAY_FAILED",
      message: "문자 발송에 실패했습니다.",
      failureReason: result.failureReason ?? undefined,
      logId: result.logId,
      messageLogId: result.logId,
      sentAt: result.sentAt,
      providerResponse: result.providerResponse ?? null,
      relaySummary: summarizeRelayResponse(result.providerResponse),
      retryable: result.retryable ?? true,
    },
    { status: result.relayFailureCode === "LOG_SAVE_FAILED" ? 500 : 502 },
  );
}
