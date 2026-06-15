import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeInboundSenderPhone, phonesMatchForInquiry } from "@/lib/sms/normalizeInboundPhone";

export type InboundSmsMatchResult = {
  inquiryId: string | null;
  memberId: string | null;
  matchStatus: "matched" | "unmatched";
  matchReason: string | null;
};

async function findInquiryByPhone(senderPhone: string, openOnly: boolean): Promise<{ id: string; phone: string } | null> {
  const normalized = normalizeInboundSenderPhone(senderPhone);
  if (!normalized) return null;

  let query = supabaseAdmin
    .from("inquiries")
    .select("id, phone, consultation_status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (openOnly) {
    query = query.in("consultation_status", ["new", "contacted"]);
  }

  const { data, error } = await query;
  if (error || !data?.length) return null;

  for (const row of data) {
    const phone = typeof row.phone === "string" ? row.phone : "";
    if (phonesMatchForInquiry(phone, normalized)) {
      return { id: String(row.id), phone };
    }
  }
  return null;
}

async function findMemberByPhone(senderPhone: string): Promise<{ id: string; phone: string } | null> {
  const normalized = normalizeInboundSenderPhone(senderPhone);
  if (!normalized) return null;

  const { data, error } = await supabaseAdmin
    .from("members")
    .select("id, phone, created_at")
    .not("phone", "is", null)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error || !data?.length) return null;

  for (const row of data) {
    const phone = typeof row.phone === "string" ? row.phone : "";
    if (phonesMatchForInquiry(phone, normalized)) {
      return { id: String(row.id), phone };
    }
  }
  return null;
}

/** @deprecated use matchInboundSms */
export async function matchInboundSmsToInquiry(senderPhone: string): Promise<InboundSmsMatchResult> {
  return matchInboundSms(senderPhone);
}

export async function matchInboundSms(senderPhone: string): Promise<InboundSmsMatchResult> {
  const open = await findInquiryByPhone(senderPhone, true);
  if (open) {
    return {
      inquiryId: open.id,
      memberId: null,
      matchStatus: "matched",
      matchReason: "phone_exact_open_inquiry",
    };
  }

  const any = await findInquiryByPhone(senderPhone, false);
  if (any) {
    return {
      inquiryId: any.id,
      memberId: null,
      matchStatus: "matched",
      matchReason: "phone_exact_latest_inquiry",
    };
  }

  const member = await findMemberByPhone(senderPhone);
  if (member) {
    return {
      inquiryId: null,
      memberId: member.id,
      matchStatus: "matched",
      matchReason: "phone_exact_member",
    };
  }

  return {
    inquiryId: null,
    memberId: null,
    matchStatus: "unmatched",
    matchReason: null,
  };
}
