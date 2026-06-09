import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { linkInquiryToMember, unlinkInquiryMember, resolveMemberIdForInquiry } from "@/lib/customerAccountLinks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePhone } from "@/lib/customerProfiles";

type LinkBody = {
  member_id?: string;
  phone?: string;
  username?: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: inquiryId } = await context.params;

  const { data: inquiry, error } = await supabaseAdmin
    .from("inquiries")
    .select("id, member_id, customer_profile_id")
    .eq("id", inquiryId)
    .maybeSingle();

  if (error || !inquiry) {
    return NextResponse.json({ message: "문의를 찾을 수 없습니다." }, { status: 404 });
  }

  const memberId = await resolveMemberIdForInquiry(inquiryId);
  if (!memberId) {
    return NextResponse.json({ linked: false, member: null });
  }

  const linkSource =
    inquiry.member_id && String(inquiry.member_id) === memberId ? "member_id" : "profile";

  const { data: member } = await supabaseAdmin
    .from("members")
    .select("id, username, name, phone, email")
    .eq("id", memberId)
    .maybeSingle();

  return NextResponse.json({
    linked: true,
    link_source: linkSource,
    member: member ?? null,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: inquiryId } = await context.params;
  const body = (await request.json()) as LinkBody;

  let memberId = body.member_id?.trim() ?? "";

  if (!memberId && body.phone?.trim()) {
    const phone = normalizePhone(body.phone);
    const { data } = await supabaseAdmin
      .from("members")
      .select("id")
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();
    memberId = data?.id ? String(data.id) : "";
  }

  if (!memberId && body.username?.trim()) {
    const { data } = await supabaseAdmin
      .from("members")
      .select("id")
      .eq("username", body.username.trim())
      .maybeSingle();
    memberId = data?.id ? String(data.id) : "";
  }

  if (!memberId) {
    return NextResponse.json({ message: "연결할 회원(member_id, phone, username)을 지정해 주세요." }, { status: 400 });
  }

  const result = await linkInquiryToMember(inquiryId, memberId);
  if (!result.success) {
    return NextResponse.json({ message: result.message }, { status: 400 });
  }

  const { data: member } = await supabaseAdmin
    .from("members")
    .select("id, username, name, phone, email")
    .eq("id", memberId)
    .maybeSingle();

  return NextResponse.json({
    message:
      result.claimedCount > 0
        ? `회원이 연결되었습니다. 기존 후기 자격 ${result.claimedCount}건이 부여되었습니다.`
        : "회원이 연결되었습니다.",
    member,
    claimedCount: result.claimedCount,
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: inquiryId } = await context.params;
  const ok = await unlinkInquiryMember(inquiryId);

  if (!ok) {
    return NextResponse.json({ message: "회원 연결 해제에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ message: "회원 연결이 해제되었습니다." });
}
