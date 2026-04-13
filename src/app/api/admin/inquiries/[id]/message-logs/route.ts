import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabase } from "@/lib/supabase";
import type { InquiryMessageLog } from "@/types/inquiry";

function mapRow(row: Record<string, unknown>): InquiryMessageLog {
  return {
    id: String(row.id ?? ""),
    inquiry_id: String(row.inquiry_id ?? ""),
    channel: typeof row.channel === "string" ? row.channel : "sms",
    recipient_phone: typeof row.recipient_phone === "string" ? row.recipient_phone : "",
    message: typeof row.message === "string" ? row.message : "",
    provider: typeof row.provider === "string" ? row.provider : "aligo_relay",
    send_status: row.send_status === "failed" ? "failed" : "success",
    provider_response:
      row.provider_response != null && typeof row.provider_response === "object" && !Array.isArray(row.provider_response)
        ? (row.provider_response as Record<string, unknown>)
        : null,
    failure_reason: typeof row.failure_reason === "string" ? row.failure_reason : null,
    actor_name: typeof row.actor_name === "string" ? row.actor_name : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: inquiryId } = await context.params;
  const limit = 10;

  const { data, error } = await supabase
    .from("inquiry_message_logs")
    .select("id, inquiry_id, recipient_phone, message, send_status, failure_reason, created_at, channel, provider, actor_name, provider_response")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ message: "발송 이력을 불러오지 못했습니다." }, { status: 500 });
  }

  const logs = (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  return NextResponse.json({ logs });
}
