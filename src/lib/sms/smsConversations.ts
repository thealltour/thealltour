import "server-only";

import { normalizeInboundSenderPhone, phonesMatchForInquiry } from "@/lib/sms/normalizeInboundPhone";
import { mapInboundSmsRow, mergeSmsThreadItems, truncateSmsPreview } from "@/lib/sms/inboundSmsRepository";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  InboundSmsMatchStatus,
  InquiryInboundSms,
  InquirySmsThreadItem,
  SmsConversationSummary,
} from "@/types/inquiry";

export type { SmsConversationSummary };

export type SmsThreadByPhoneResult = {
  thread: InquirySmsThreadItem[];
  unreadInboundCount: number;
  inquiry: { id: string; name: string; phone: string } | null;
  unmatchedInboundIds: string[];
};

type ConversationAccumulator = {
  phone: string;
  lastMessageAt: string;
  lastPreview: string;
  unreadCount: number;
  hasUnmatched: boolean;
  inquiryId: string | null;
  hasOutbound: boolean;
};

const FETCH_LIMIT = 800;

function phoneKey(raw: string): string {
  return normalizeInboundSenderPhone(raw);
}

function isMoreRecent(a: string, b: string): boolean {
  return new Date(a).getTime() > new Date(b).getTime();
}

function upsertConversation(
  map: Map<string, ConversationAccumulator>,
  phone: string,
  input: {
    at: string;
    preview: string;
    unreadDelta?: number;
    inquiryId?: string | null;
    hasOutbound?: boolean;
    isUnmatched?: boolean;
  },
) {
  const key = phoneKey(phone);
  if (!key) return;

  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      phone: key,
      lastMessageAt: input.at,
      lastPreview: input.preview,
      unreadCount: input.unreadDelta ?? 0,
      hasUnmatched: input.isUnmatched ?? false,
      inquiryId: input.inquiryId ?? null,
      hasOutbound: input.hasOutbound ?? false,
    });
    return;
  }

  if (isMoreRecent(input.at, existing.lastMessageAt)) {
    existing.lastMessageAt = input.at;
    existing.lastPreview = input.preview;
    if (input.inquiryId) existing.inquiryId = input.inquiryId;
  } else if (input.inquiryId && !existing.inquiryId) {
    existing.inquiryId = input.inquiryId;
  }

  existing.unreadCount += input.unreadDelta ?? 0;
  if (input.isUnmatched) existing.hasUnmatched = true;
  if (input.hasOutbound) existing.hasOutbound = true;
}

async function loadInquiryNames(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};

  const { data, error } = await supabaseAdmin
    .from("inquiries")
    .select("id, name")
    .in("id", ids);

  if (error || !data) return {};

  const names: Record<string, string> = {};
  for (const row of data) {
    names[String(row.id)] = typeof row.name === "string" ? row.name : "이름 없음";
  }
  return names;
}

export async function listSmsConversations(input: {
  filter: "all" | "unread" | "unmatched";
  q?: string;
  page: number;
  pageSize: number;
}): Promise<{ items: SmsConversationSummary[]; total: number; page: number; pageSize: number }> {
  const [inboundRes, outboundRes] = await Promise.all([
    supabaseAdmin
      .from("inquiry_inbound_sms")
      .select(
        "id, sender_phone, message, received_at, inquiry_id, match_status, read_at, created_at",
      )
      .order("received_at", { ascending: false })
      .limit(FETCH_LIMIT),
    supabaseAdmin
      .from("inquiry_message_logs")
      .select("id, recipient_phone, message, created_at, inquiry_id")
      .order("created_at", { ascending: false })
      .limit(FETCH_LIMIT),
  ]);

  if (inboundRes.error?.code === "42P01") {
    return { items: [], total: 0, page: input.page, pageSize: input.pageSize };
  }

  const map = new Map<string, ConversationAccumulator>();

  for (const row of inboundRes.data ?? []) {
    const sender = typeof row.sender_phone === "string" ? row.sender_phone : "";
    const at = typeof row.received_at === "string" ? row.received_at : "";
    const message = typeof row.message === "string" ? row.message : "";
    const inquiryId = row.inquiry_id != null ? String(row.inquiry_id) : null;
    const matchStatus = row.match_status as InboundSmsMatchStatus;
    const isUnread = row.read_at == null;

    upsertConversation(map, sender, {
      at,
      preview: truncateSmsPreview(message),
      unreadDelta: isUnread ? 1 : 0,
      inquiryId,
      isUnmatched: matchStatus === "unmatched" && !inquiryId,
    });
  }

  for (const row of outboundRes.data ?? []) {
    const recipient = typeof row.recipient_phone === "string" ? row.recipient_phone : "";
    const at = typeof row.created_at === "string" ? row.created_at : "";
    const message = typeof row.message === "string" ? row.message : "";
    const inquiryId = row.inquiry_id != null ? String(row.inquiry_id) : null;

    upsertConversation(map, recipient, {
      at,
      preview: truncateSmsPreview(message),
      inquiryId,
      hasOutbound: true,
    });
  }

  let conversations = [...map.values()];

  const searchDigits = input.q ? phoneKey(input.q) : "";
  if (searchDigits) {
    conversations = conversations.filter((c) => c.phone.includes(searchDigits));
  }

  if (input.filter === "unread") {
    conversations = conversations.filter((c) => c.unreadCount > 0);
  } else if (input.filter === "unmatched") {
    conversations = conversations.filter((c) => c.hasUnmatched || !c.inquiryId);
  }

  conversations.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  const total = conversations.length;
  const from = (input.page - 1) * input.pageSize;
  const pageSlice = conversations.slice(from, from + input.pageSize);

  const inquiryIds = [...new Set(pageSlice.map((c) => c.inquiryId).filter(Boolean) as string[])];
  const inquiryNames = await loadInquiryNames(inquiryIds);

  const items: SmsConversationSummary[] = pageSlice.map((c) => ({
    phone: c.phone,
    lastMessageAt: c.lastMessageAt,
    lastPreview: c.lastPreview,
    unreadCount: c.unreadCount,
    matchStatus: c.hasUnmatched || !c.inquiryId ? "unmatched" : "matched",
    inquiryId: c.inquiryId,
    inquiryName: c.inquiryId ? (inquiryNames[c.inquiryId] ?? null) : null,
    hasOutbound: c.hasOutbound,
  }));

  return { items, total, page: input.page, pageSize: input.pageSize };
}

async function findInquiriesByPhone(normalizedPhone: string): Promise<
  Array<{ id: string; name: string; phone: string; created_at: string }>
> {
  const { data, error } = await supabaseAdmin
    .from("inquiries")
    .select("id, name, phone, created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error || !data) return [];

  return data
    .filter((row) => {
      const phone = typeof row.phone === "string" ? row.phone : "";
      return phonesMatchForInquiry(phone, normalizedPhone);
    })
    .map((row) => ({
      id: String(row.id),
      name: typeof row.name === "string" ? row.name : "이름 없음",
      phone: typeof row.phone === "string" ? row.phone : "",
      created_at: typeof row.created_at === "string" ? row.created_at : "",
    }));
}

export async function getSmsThreadByPhone(phone: string): Promise<SmsThreadByPhoneResult | null> {
  const normalized = phoneKey(phone);
  if (!normalized) return null;

  const [inboundRes, matchedInquiries] = await Promise.all([
    supabaseAdmin
      .from("inquiry_inbound_sms")
      .select(
        "id, provider, provider_message_id, sender_phone, message, received_at, inquiry_id, match_status, match_reason, read_at, created_at",
      )
      .order("received_at", { ascending: false })
      .limit(200),
    findInquiriesByPhone(normalized),
  ]);

  if (inboundRes.error?.code === "42P01") {
    return { thread: [], unreadInboundCount: 0, inquiry: matchedInquiries[0] ?? null, unmatchedInboundIds: [] };
  }

  const inboundRows = (inboundRes.data ?? []).filter((row) => {
    const sender = typeof row.sender_phone === "string" ? row.sender_phone : "";
    return phonesMatchForInquiry(sender, normalized);
  });

  const inbound = inboundRows.map((r) => mapInboundSmsRow(r as Record<string, unknown>));
  const inquiryIds = new Set<string>();

  for (const row of inbound) {
    if (row.inquiry_id) inquiryIds.add(row.inquiry_id);
  }
  for (const inq of matchedInquiries) {
    inquiryIds.add(inq.id);
  }

  const primaryInquiry = matchedInquiries[0] ?? null;

  let outbound: Array<{
    id: string;
    recipient_phone: string;
    message: string;
    created_at: string;
    send_status: string;
    provider: string;
    actor_name?: string | null;
    failure_reason?: string | null;
  }> = [];

  const outboundQueries = [];

  if (inquiryIds.size > 0) {
    outboundQueries.push(
      supabaseAdmin
        .from("inquiry_message_logs")
        .select(
          "id, recipient_phone, message, created_at, send_status, provider, actor_name, failure_reason",
        )
        .in("inquiry_id", [...inquiryIds])
        .order("created_at", { ascending: false })
        .limit(100),
    );
  }

  outboundQueries.push(
    supabaseAdmin
      .from("inquiry_message_logs")
      .select(
        "id, recipient_phone, message, created_at, send_status, provider, actor_name, failure_reason",
      )
      .is("inquiry_id", null)
      .order("created_at", { ascending: false })
      .limit(100),
  );

  const outboundResults = await Promise.all(outboundQueries);
  const outboundMap = new Map<string, (typeof outbound)[number]>();

  for (const res of outboundResults) {
    if (res.error || !res.data) continue;
    for (const row of res.data) {
      const recipient = typeof row.recipient_phone === "string" ? row.recipient_phone : "";
      if (!phonesMatchForInquiry(recipient, normalized)) continue;
      const id = String(row.id ?? "");
      if (!id || outboundMap.has(id)) continue;
      outboundMap.set(id, row as (typeof outbound)[number]);
    }
  }

  outbound = [...outboundMap.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const thread = mergeSmsThreadItems({ outbound, inbound });
  const unreadInboundCount = inbound.filter((row) => !row.read_at).length;
  const unmatchedInboundIds = inbound
    .filter((row) => row.match_status === "unmatched" && !row.inquiry_id)
    .map((row) => row.id);

  const linkedInquiryId = inbound.find((row) => row.inquiry_id)?.inquiry_id ?? primaryInquiry?.id ?? null;
  let inquiry: { id: string; name: string; phone: string } | null = primaryInquiry;

  if (linkedInquiryId && (!inquiry || inquiry.id !== linkedInquiryId)) {
    const { data: inqRow } = await supabaseAdmin
      .from("inquiries")
      .select("id, name, phone")
      .eq("id", linkedInquiryId)
      .maybeSingle();
    if (inqRow) {
      inquiry = {
        id: String(inqRow.id),
        name: typeof inqRow.name === "string" ? inqRow.name : "이름 없음",
        phone: typeof inqRow.phone === "string" ? inqRow.phone : "",
      };
    }
  }

  return { thread, unreadInboundCount, inquiry, unmatchedInboundIds };
}

export async function markSmsThreadReadByPhone(phone: string): Promise<{ ok: boolean; read_at?: string }> {
  const normalized = phoneKey(phone);
  if (!normalized) return { ok: false };

  const nowIso = new Date().toISOString();

  const { data: rows, error: fetchErr } = await supabaseAdmin
    .from("inquiry_inbound_sms")
    .select("id, sender_phone")
    .is("read_at", null);

  if (fetchErr) {
    if (fetchErr.code === "42P01") return { ok: true };
    return { ok: false };
  }

  const ids = (rows ?? [])
    .filter((row) => {
      const sender = typeof row.sender_phone === "string" ? row.sender_phone : "";
      return phonesMatchForInquiry(sender, normalized);
    })
    .map((row) => String(row.id));

  if (ids.length === 0) return { ok: true, read_at: nowIso };

  const { error } = await supabaseAdmin
    .from("inquiry_inbound_sms")
    .update({ read_at: nowIso })
    .in("id", ids);

  if (error) return { ok: false };
  return { ok: true, read_at: nowIso };
}

export async function getGlobalUnreadInboundCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("inquiry_inbound_sms")
    .select("*", { count: "exact", head: true })
    .is("read_at", null);

  if (error) return 0;
  return count ?? 0;
}
