import "server-only";

import { createInboundSmsReplyNotification } from "@/lib/adminNotifications";
import { appendInquiryActivityLog } from "@/lib/inquiries/inquiryActivityLog";
import { matchInboundSmsToInquiry } from "@/lib/sms/matchInboundSmsToInquiry";
import { normalizeInboundSenderPhone } from "@/lib/sms/normalizeInboundPhone";
import { mapInboundSmsRow, truncateSmsPreview } from "@/lib/sms/inboundSmsRepository";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TextbeeWebhookPayload } from "@/lib/sms/textbeeWebhook";
import { parseTextbeeReceivedEvent } from "@/lib/sms/textbeeWebhook";

export type ProcessTextbeeInboundResult =
  | { ok: true; duplicate: true }
  | { ok: true; duplicate: false; inboundSmsId: string; inquiryId: string | null; matchStatus: string }
  | { ok: false; reason: string };

export async function processTextbeeInboundWebhook(
  payload: TextbeeWebhookPayload,
): Promise<ProcessTextbeeInboundResult> {
  const parsed = parseTextbeeReceivedEvent(payload);
  if (!parsed) {
    return { ok: false, reason: "not_message_received" };
  }

  const { providerMessageId, sender, message, receivedAt } = parsed;
  const senderPhone = normalizeInboundSenderPhone(sender);
  if (!senderPhone) {
    return { ok: false, reason: "invalid_sender" };
  }

  const { data: existing } = await supabaseAdmin
    .from("inquiry_inbound_sms")
    .select("id")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();

  if (existing?.id) {
    return { ok: true, duplicate: true };
  }

  const match = await matchInboundSmsToInquiry(senderPhone);

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("inquiry_inbound_sms")
    .insert({
      provider: "textbee",
      provider_message_id: providerMessageId,
      sender_phone: senderPhone,
      message: message || "(내용 없음)",
      received_at: receivedAt,
      inquiry_id: match.inquiryId,
      match_status: match.matchStatus,
      match_reason: match.matchReason,
      raw_payload: payload as Record<string, unknown>,
    })
    .select("*")
    .maybeSingle();

  if (insertErr || !inserted) {
    if (insertErr?.code === "23505") {
      return { ok: true, duplicate: true };
    }
    console.error("[textbeeInbound] insert failed", insertErr);
    return { ok: false, reason: "db_insert_failed" };
  }

  const inbound = mapInboundSmsRow(inserted as Record<string, unknown>);
  const preview = truncateSmsPreview(inbound.message);

  if (match.inquiryId) {
    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      last_contacted_at: nowIso,
      last_activity_at: nowIso,
    };

    const { data: inquiryRow } = await supabaseAdmin
      .from("inquiries")
      .select("consultation_status, response_stage")
      .eq("id", match.inquiryId)
      .maybeSingle();

    if (inquiryRow?.consultation_status === "new") {
      updatePayload.consultation_status = "contacted";
    }
    if (!inquiryRow?.response_stage) {
      updatePayload.response_stage = "waiting_customer";
    }

    await supabaseAdmin.from("inquiries").update(updatePayload).eq("id", match.inquiryId);

    await appendInquiryActivityLog(supabaseAdmin, {
      inquiry_id: match.inquiryId,
      activity_type: "manual_log",
      summary: `고객 SMS 수신: ${preview}`,
      metadata: {
        inbound_sms_id: inbound.id,
        sender_phone: senderPhone,
        provider: "textbee",
      },
    });
  }

  await createInboundSmsReplyNotification({
    inboundSmsId: inbound.id,
    inquiryId: match.inquiryId,
    senderPhone,
    messagePreview: preview,
    matchStatus: match.matchStatus,
  });

  return {
    ok: true,
    duplicate: false,
    inboundSmsId: inbound.id,
    inquiryId: match.inquiryId,
    matchStatus: match.matchStatus,
  };
}
