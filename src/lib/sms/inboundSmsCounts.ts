import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function getUnreadInboundCountsByInquiryIds(
  inquiryIds: string[],
): Promise<Record<string, number>> {
  if (inquiryIds.length === 0) return {};

  const { data, error } = await supabaseAdmin
    .from("inquiry_inbound_sms")
    .select("inquiry_id")
    .in("inquiry_id", inquiryIds)
    .is("read_at", null);

  if (error || !data) return {};

  const counts: Record<string, number> = {};
  for (const row of data) {
    const id = row.inquiry_id != null ? String(row.inquiry_id) : "";
    if (!id) continue;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

export async function getInquiryIdsWithUnreadInbound(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("inquiry_inbound_sms")
    .select("inquiry_id")
    .is("read_at", null)
    .not("inquiry_id", "is", null);

  if (error || !data) return [];

  const ids = new Set<string>();
  for (const row of data) {
    if (row.inquiry_id != null) ids.add(String(row.inquiry_id));
  }
  return [...ids];
}

export async function getUnmatchedInboundCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("inquiry_inbound_sms")
    .select("*", { count: "exact", head: true })
    .eq("match_status", "unmatched");

  if (error) return 0;
  return count ?? 0;
}
