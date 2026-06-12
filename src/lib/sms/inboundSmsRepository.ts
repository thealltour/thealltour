import "server-only";

import type { InboundSmsMatchStatus, InquiryInboundSms, InquirySmsThreadItem } from "@/types/inquiry";

export function mapInboundSmsRow(row: Record<string, unknown>): InquiryInboundSms {
  return {
    id: String(row.id ?? ""),
    provider: typeof row.provider === "string" ? row.provider : "textbee",
    provider_message_id: typeof row.provider_message_id === "string" ? row.provider_message_id : "",
    sender_phone: typeof row.sender_phone === "string" ? row.sender_phone : "",
    message: typeof row.message === "string" ? row.message : "",
    received_at: typeof row.received_at === "string" ? row.received_at : "",
    inquiry_id:
      row.inquiry_id === null || row.inquiry_id === undefined ? null : String(row.inquiry_id),
    match_status: (row.match_status as InboundSmsMatchStatus) ?? "unmatched",
    match_reason: typeof row.match_reason === "string" ? row.match_reason : null,
    read_at: typeof row.read_at === "string" ? row.read_at : row.read_at === null ? null : undefined,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  };
}

export function mergeSmsThreadItems(input: {
  outbound: Array<{
    id: string;
    recipient_phone: string;
    message: string;
    created_at: string;
    send_status: string;
    provider: string;
    actor_name?: string | null;
    failure_reason?: string | null;
  }>;
  inbound: InquiryInboundSms[];
}): InquirySmsThreadItem[] {
  const outboundItems: InquirySmsThreadItem[] = input.outbound.map((row) => ({
    id: row.id,
    direction: "outbound" as const,
    phone: row.recipient_phone,
    message: row.message,
    at: row.created_at,
    send_status: row.send_status === "failed" ? "failed" : "success",
    provider: row.provider,
    actor_name: row.actor_name ?? null,
    failure_reason: row.failure_reason ?? null,
  }));

  const inboundItems: InquirySmsThreadItem[] = input.inbound.map((row) => ({
    id: row.id,
    direction: "inbound" as const,
    phone: row.sender_phone,
    message: row.message,
    at: row.received_at || row.created_at,
    provider: row.provider,
    match_status: row.match_status,
    read_at: row.read_at ?? null,
  }));

  return [...outboundItems, ...inboundItems].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

export function truncateSmsPreview(text: string, max = 40): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}
