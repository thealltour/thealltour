import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { mapInboundSmsRow, mergeSmsThreadItems } from "@/lib/sms/inboundSmsRepository";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: inquiryId } = await context.params;
  const limit = 30;

  const [outboundRes, inboundRes] = await Promise.all([
    supabaseAdmin
      .from("inquiry_message_logs")
      .select(
        "id, recipient_phone, message, created_at, send_status, provider, actor_name, failure_reason",
      )
      .eq("inquiry_id", inquiryId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabaseAdmin
      .from("inquiry_inbound_sms")
      .select(
        "id, provider, provider_message_id, sender_phone, message, received_at, inquiry_id, match_status, match_reason, read_at, created_at",
      )
      .eq("inquiry_id", inquiryId)
      .order("received_at", { ascending: false })
      .limit(limit),
  ]);

  if (outboundRes.error) {
    return NextResponse.json({ message: "발송 이력을 불러오지 못했습니다." }, { status: 500 });
  }
  if (inboundRes.error) {
    if (inboundRes.error.code === "42P01") {
      return NextResponse.json({ thread: [], unreadInboundCount: 0 });
    }
    return NextResponse.json({ message: "수신 이력을 불러오지 못했습니다." }, { status: 500 });
  }

  const inbound = (inboundRes.data ?? []).map((r) => mapInboundSmsRow(r as Record<string, unknown>));
  const thread = mergeSmsThreadItems({
    outbound: (outboundRes.data ?? []) as Array<{
      id: string;
      recipient_phone: string;
      message: string;
      created_at: string;
      send_status: string;
      provider: string;
      actor_name?: string | null;
      failure_reason?: string | null;
    }>,
    inbound,
  });

  const unreadInboundCount = inbound.filter((row) => !row.read_at).length;

  return NextResponse.json({ thread, unreadInboundCount });
}
