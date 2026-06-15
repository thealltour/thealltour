import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeInboundSenderPhone, phonesMatchForInquiry } from "@/lib/sms/normalizeInboundPhone";

export type LinkInboundSmsToMemberResult = {
  linkedCount: number;
};

/**
 * 미연결 수신 SMS를 회원 전화번호와 매칭해 member_id를 설정합니다.
 * 회원 가입·전화 등록 시 backfill 용도.
 */
export async function linkUnmatchedInboundSmsToMember(input: {
  memberId: string;
  phone: string;
  matchReason?: string;
}): Promise<LinkInboundSmsToMemberResult> {
  const memberId = input.memberId.trim();
  const normalized = normalizeInboundSenderPhone(input.phone);
  if (!memberId || !normalized) {
    return { linkedCount: 0 };
  }

  const { data: rows, error } = await supabaseAdmin
    .from("inquiry_inbound_sms")
    .select("id, sender_phone")
    .eq("match_status", "unmatched")
    .is("inquiry_id", null)
    .is("member_id", null);

  if (error) {
    if (error.code === "42P01") return { linkedCount: 0 };
    console.error("[linkUnmatchedInboundSmsToMember] fetch failed", error);
    return { linkedCount: 0 };
  }

  const ids = (rows ?? [])
    .filter((row) => {
      const sender = typeof row.sender_phone === "string" ? row.sender_phone : "";
      return phonesMatchForInquiry(sender, normalized);
    })
    .map((row) => String(row.id));

  if (ids.length === 0) return { linkedCount: 0 };

  const { error: updateErr } = await supabaseAdmin
    .from("inquiry_inbound_sms")
    .update({
      member_id: memberId,
      match_status: "matched",
      match_reason: input.matchReason ?? "phone_exact_member_on_signup",
    })
    .in("id", ids);

  if (updateErr) {
    console.error("[linkUnmatchedInboundSmsToMember] update failed", updateErr);
    return { linkedCount: 0 };
  }

  return { linkedCount: ids.length };
}
