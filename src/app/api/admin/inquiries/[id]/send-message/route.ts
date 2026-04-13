import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendInquiryActivityLog } from "@/lib/inquiries/inquiryActivityLog";
import {
  AligoRelayError,
  normalizeReceiverPhone,
  sendAligoRelay,
} from "@/lib/notifications/sendAligoRelay";

const DEFAULT_ACTOR = "관리자";

type PostBody = {
  message?: string;
  receiver?: string | null;
  actor_name?: string | null;
};

function jsonSafe(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

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

function mapRelayErrorToApiCode(err: AligoRelayError): string {
  switch (err.code) {
    case "RELAY_TIMEOUT":
      return "RELAY_TIMEOUT";
    case "RELAY_NETWORK":
      return "RELAY_NETWORK";
    case "RELAY_HTTP":
      return "RELAY_HTTP_ERROR";
    case "EMPTY_RECEIVER":
      return "RELAY_EMPTY_RECEIVER";
    default:
      return "RELAY_FAILED";
  }
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

  const { data: inquiryRow, error: inquiryErr } = await supabase
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
    typeof body.receiver === "string" && body.receiver.trim() ? body.receiver.trim() : String(inquiryRow.phone ?? "");
  const receiver = normalizeReceiverPhone(receiverInput);
  if (!receiver) {
    return NextResponse.json(
      { ok: false, code: "INVALID_PHONE", message: "유효한 수신번호가 없습니다.", retryable: false },
      { status: 400 },
    );
  }

  const actorName =
    typeof body.actor_name === "string" && body.actor_name.trim() ? body.actor_name.trim() : DEFAULT_ACTOR;

  const activityMeta = {
    channel: "sms",
    recipient_phone: receiver,
    message_preview: message.slice(0, 80),
  };

  let sendStatus: "success" | "failed" = "failed";
  let providerResponse: unknown = null;
  let failureReason: string | null = null;
  let relayFailureCode: string | null = null;

  try {
    const result = await sendAligoRelay({ receiver, msg: message });
    sendStatus = "success";
    providerResponse = result.data;
  } catch (e) {
    if (e instanceof AligoRelayError) {
      relayFailureCode = mapRelayErrorToApiCode(e);
      failureReason = e.message;
      providerResponse = e.data ?? null;
    } else if (e instanceof Error) {
      relayFailureCode = "RELAY_FAILED";
      failureReason = e.message;
    } else {
      relayFailureCode = "RELAY_FAILED";
      failureReason = String(e);
    }
  }

  const providerJson = jsonSafe(providerResponse) ?? (providerResponse === null ? null : { raw: providerResponse });

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("inquiry_message_logs")
    .insert({
      inquiry_id: inquiryId,
      channel: "sms",
      recipient_phone: receiver,
      message,
      provider: "aligo_relay",
      send_status: sendStatus,
      provider_response: providerJson,
      failure_reason: failureReason,
      actor_name: actorName,
    })
    .select("id, created_at")
    .maybeSingle();

  if (insertErr) {
    console.error("[send-message] inquiry_message_logs insert failed", insertErr);
    return NextResponse.json(
      {
        ok: false,
        code: "LOG_SAVE_FAILED",
        message: "발송 로그 저장에 실패했습니다.",
        retryable: true,
      },
      { status: 500 },
    );
  }

  const logId = inserted?.id ?? null;
  const sentAt =
    typeof inserted?.created_at === "string" ? inserted.created_at : new Date().toISOString();

  const nowIso = new Date().toISOString();
  await supabase.from("inquiries").update({ last_activity_at: nowIso }).eq("id", inquiryId);

  const activitySummary = sendStatus === "success" ? "문자 발송 성공" : "문자 발송 실패";
  const { error: actErr } = await appendInquiryActivityLog(supabase, {
    inquiry_id: inquiryId,
    activity_type: "manual_log",
    actor_name: actorName,
    summary: activitySummary,
    metadata: { ...activityMeta, send_status: sendStatus, inquiry_message_log_id: logId },
  });
  if (actErr) {
    console.error("[send-message] activity log append failed", actErr);
  }

  if (sendStatus === "success") {
    return NextResponse.json({
      ok: true,
      logId,
      messageLogId: logId,
      sentAt,
      relaySummary: summarizeRelayResponse(providerResponse),
      providerResponse: providerResponse ?? null,
    });
  }

  return NextResponse.json(
    {
      ok: false,
      code: relayFailureCode ?? "RELAY_FAILED",
      message: "문자 발송에 실패했습니다.",
      failureReason: failureReason ?? undefined,
      logId,
      messageLogId: logId,
      sentAt,
      providerResponse: providerResponse ?? null,
      relaySummary: summarizeRelayResponse(providerResponse),
      retryable: true,
    },
    { status: 502 },
  );
}
