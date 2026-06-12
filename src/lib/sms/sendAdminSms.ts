import "server-only";

import { createOutboundSmsFailedNotification } from "@/lib/adminNotifications";
import { appendInquiryActivityLog } from "@/lib/inquiries/inquiryActivityLog";
import {
  AligoRelayError,
  normalizeReceiverPhone,
  sendAligoRelay,
} from "@/lib/notifications/sendAligoRelay";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_ACTOR = "관리자";

export type SendAdminSmsInput = {
  receiver: string;
  message: string;
  inquiryId?: string | null;
  actorName?: string;
  skipFailureNotification?: boolean;
};

export type SendAdminSmsResult = {
  ok: boolean;
  logId: string | null;
  sentAt: string;
  sendStatus: "success" | "failed";
  failureReason?: string | null;
  relayFailureCode?: string | null;
  providerResponse?: unknown;
  retryable?: boolean;
};

function jsonSafe(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
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

export async function sendAdminSms(input: SendAdminSmsInput): Promise<SendAdminSmsResult> {
  const message = input.message.trim();
  const receiver = normalizeReceiverPhone(input.receiver);
  const actorName = input.actorName?.trim() || DEFAULT_ACTOR;
  const inquiryId = input.inquiryId?.trim() || null;

  if (!message) {
    return {
      ok: false,
      logId: null,
      sentAt: new Date().toISOString(),
      sendStatus: "failed",
      failureReason: "메시지 내용이 비어 있습니다.",
      relayFailureCode: "EMPTY_MESSAGE",
      retryable: false,
    };
  }

  if (!receiver) {
    return {
      ok: false,
      logId: null,
      sentAt: new Date().toISOString(),
      sendStatus: "failed",
      failureReason: "유효한 수신번호가 없습니다.",
      relayFailureCode: "INVALID_PHONE",
      retryable: false,
    };
  }

  if (inquiryId) {
    const { data: inquiryRow, error: inquiryErr } = await supabaseAdmin
      .from("inquiries")
      .select("id")
      .eq("id", inquiryId)
      .maybeSingle();
    if (inquiryErr || !inquiryRow) {
      return {
        ok: false,
        logId: null,
        sentAt: new Date().toISOString(),
        sendStatus: "failed",
        failureReason: "문의를 찾을 수 없습니다.",
        relayFailureCode: "INQUIRY_NOT_FOUND",
        retryable: false,
      };
    }
  }

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

  const insertPayload: Record<string, unknown> = {
    channel: "sms",
    recipient_phone: receiver,
    message,
    provider: "aligo_relay",
    send_status: sendStatus,
    provider_response: providerJson,
    failure_reason: failureReason,
    actor_name: actorName,
  };
  if (inquiryId) insertPayload.inquiry_id = inquiryId;

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("inquiry_message_logs")
    .insert(insertPayload)
    .select("id, created_at")
    .maybeSingle();

  if (insertErr) {
    console.error("[sendAdminSms] log insert failed", insertErr);
    return {
      ok: false,
      logId: null,
      sentAt: new Date().toISOString(),
      sendStatus: "failed",
      failureReason: "발송 로그 저장에 실패했습니다.",
      relayFailureCode: "LOG_SAVE_FAILED",
      retryable: true,
    };
  }

  const logId = inserted?.id != null ? String(inserted.id) : null;
  const sentAt = typeof inserted?.created_at === "string" ? inserted.created_at : new Date().toISOString();

  if (inquiryId) {
    const nowIso = new Date().toISOString();
    await supabaseAdmin.from("inquiries").update({ last_activity_at: nowIso }).eq("id", inquiryId);

    await appendInquiryActivityLog(supabaseAdmin, {
      inquiry_id: inquiryId,
      activity_type: "manual_log",
      actor_name: actorName,
      summary: sendStatus === "success" ? "문자 발송 성공" : "문자 발송 실패",
      metadata: {
        channel: "sms",
        recipient_phone: receiver,
        message_preview: message.slice(0, 80),
        send_status: sendStatus,
        inquiry_message_log_id: logId,
      },
    });
  }

  if (sendStatus === "failed" && logId && !input.skipFailureNotification) {
    await createOutboundSmsFailedNotification({
      logId,
      inquiryId,
      recipientPhone: receiver,
      failureReason: failureReason ?? "알 수 없는 오류",
    });
  }

  return {
    ok: sendStatus === "success",
    logId,
    sentAt,
    sendStatus,
    failureReason,
    relayFailureCode,
    providerResponse,
    retryable: sendStatus === "failed",
  };
}
