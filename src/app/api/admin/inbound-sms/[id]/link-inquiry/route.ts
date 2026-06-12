import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { appendInquiryActivityLog } from "@/lib/inquiries/inquiryActivityLog";
import { mapInboundSmsRow, truncateSmsPreview } from "@/lib/sms/inboundSmsRepository";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: inboundSmsId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { inquiry_id?: string };
  const inquiryId = body.inquiry_id?.trim();

  if (!inquiryId) {
    return NextResponse.json({ message: "연결할 문의 ID가 필요합니다." }, { status: 400 });
  }

  const { data: inquiry, error: inquiryErr } = await supabaseAdmin
    .from("inquiries")
    .select("id, phone")
    .eq("id", inquiryId)
    .maybeSingle();

  if (inquiryErr || !inquiry) {
    return NextResponse.json({ message: "문의를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("inquiry_inbound_sms")
    .update({
      inquiry_id: inquiryId,
      match_status: "manual_linked",
      match_reason: "manual_admin_link",
    })
    .eq("id", inboundSmsId)
    .select("*")
    .maybeSingle();

  if (updateErr || !updated) {
    return NextResponse.json({ message: "수신 SMS 연결에 실패했습니다." }, { status: 500 });
  }

  const inbound = mapInboundSmsRow(updated as Record<string, unknown>);
  const nowIso = new Date().toISOString();

  await supabaseAdmin
    .from("inquiries")
    .update({ last_contacted_at: nowIso, last_activity_at: nowIso })
    .eq("id", inquiryId);

  await appendInquiryActivityLog(supabaseAdmin, {
    inquiry_id: inquiryId,
    activity_type: "manual_log",
    summary: `수신 SMS 수동 연결: ${truncateSmsPreview(inbound.message)}`,
    metadata: {
      inbound_sms_id: inbound.id,
      sender_phone: inbound.sender_phone,
      linked_manually: true,
    },
  });

  return NextResponse.json({ ok: true, inbound, inquiryId });
}
