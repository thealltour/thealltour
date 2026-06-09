import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  getLinkedInquiriesForMember,
  linkInquiryToMember,
  searchConnectableInquiriesForMember,
  unlinkInquiryMember,
} from "@/lib/customerAccountLinks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: memberId } = await context.params;
  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";

  const { data: member, error } = await supabaseAdmin
    .from("members")
    .select("id, phone")
    .eq("id", memberId)
    .maybeSingle();

  if (error || !member) {
    return NextResponse.json({ message: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  const [linkedInquiries, connectableInquiries] = await Promise.all([
    getLinkedInquiriesForMember(memberId),
    searchConnectableInquiriesForMember(memberId, String(member.phone ?? ""), search || undefined),
  ]);

  return NextResponse.json({ linkedInquiries, connectableInquiries });
}

type LinkBody = {
  inquiry_id?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: memberId } = await context.params;
  const body = (await request.json()) as LinkBody;
  const inquiryId = body.inquiry_id?.trim();

  if (!inquiryId) {
    return NextResponse.json({ message: "inquiry_id를 지정해 주세요." }, { status: 400 });
  }

  const result = await linkInquiryToMember(inquiryId, memberId);
  if (!result.success) {
    return NextResponse.json({ message: result.message }, { status: 400 });
  }

  const linkedInquiries = await getLinkedInquiriesForMember(memberId);

  return NextResponse.json({
    message:
      result.claimedCount > 0
        ? `문의가 연결되었습니다. 후기 자격 ${result.claimedCount}건이 부여되었습니다.`
        : "문의가 연결되었습니다.",
    claimedCount: result.claimedCount,
    linkedInquiries,
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: memberId } = await context.params;
  const inquiryId = request.nextUrl.searchParams.get("inquiryId")?.trim();

  if (!inquiryId) {
    return NextResponse.json({ message: "inquiryId 쿼리 파라미터가 필요합니다." }, { status: 400 });
  }

  const { data: inquiry, error } = await supabaseAdmin
    .from("inquiries")
    .select("id, member_id")
    .eq("id", inquiryId)
    .maybeSingle();

  if (error || !inquiry) {
    return NextResponse.json({ message: "문의를 찾을 수 없습니다." }, { status: 404 });
  }

  const assignedMemberId = inquiry.member_id as string | null;
  if (assignedMemberId && String(assignedMemberId) !== memberId) {
    return NextResponse.json({ message: "다른 회원에 배정된 문의입니다." }, { status: 409 });
  }

  const ok = await unlinkInquiryMember(inquiryId);
  if (!ok) {
    return NextResponse.json({ message: "문의 연결 해제에 실패했습니다." }, { status: 500 });
  }

  const linkedInquiries = await getLinkedInquiriesForMember(memberId);

  return NextResponse.json({
    message: "문의 연결이 해제되었습니다.",
    linkedInquiries,
  });
}
