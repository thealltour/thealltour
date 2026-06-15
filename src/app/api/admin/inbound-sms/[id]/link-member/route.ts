import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { mapInboundSmsRow } from "@/lib/sms/inboundSmsRepository";
import { phonesMatchForInquiry } from "@/lib/sms/normalizeInboundPhone";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: inboundSmsId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { member_id?: string };
  const memberId = body.member_id?.trim();

  if (!memberId) {
    return NextResponse.json({ message: "연결할 회원 ID가 필요합니다." }, { status: 400 });
  }

  const { data: inboundRow, error: inboundErr } = await supabaseAdmin
    .from("inquiry_inbound_sms")
    .select("id, sender_phone")
    .eq("id", inboundSmsId)
    .maybeSingle();

  if (inboundErr || !inboundRow) {
    return NextResponse.json({ message: "수신 SMS를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: member, error: memberErr } = await supabaseAdmin
    .from("members")
    .select("id, phone, name")
    .eq("id", memberId)
    .maybeSingle();

  if (memberErr || !member) {
    return NextResponse.json({ message: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  const senderPhone = typeof inboundRow.sender_phone === "string" ? inboundRow.sender_phone : "";
  const memberPhone = typeof member.phone === "string" ? member.phone : "";
  const phoneMismatch =
    senderPhone && memberPhone && !phonesMatchForInquiry(memberPhone, senderPhone);

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("inquiry_inbound_sms")
    .update({
      member_id: memberId,
      match_status: "manual_linked",
      match_reason: "manual_admin_member_link",
    })
    .eq("id", inboundSmsId)
    .select("*")
    .maybeSingle();

  if (updateErr || !updated) {
    return NextResponse.json({ message: "수신 SMS 회원 연결에 실패했습니다." }, { status: 500 });
  }

  const inbound = mapInboundSmsRow(updated as Record<string, unknown>);

  return NextResponse.json({
    ok: true,
    inbound,
    memberId,
    phoneMismatch,
    warning: phoneMismatch ? "회원 전화번호와 SMS 발신 번호가 일치하지 않습니다." : null,
  });
}
