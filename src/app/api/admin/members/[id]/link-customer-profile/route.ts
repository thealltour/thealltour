import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  autoClaimEligibilitiesForMember,
  linkMemberToCustomerProfile,
  linkInquiryToMember,
} from "@/lib/customerAccountLinks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  customer_profile_id?: string;
  inquiry_id?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: memberId } = await context.params;
  const body = (await request.json()) as Body;

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("id")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError || !member) {
    return NextResponse.json({ message: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  if (body.inquiry_id?.trim()) {
    const result = await linkInquiryToMember(body.inquiry_id.trim(), memberId);
    if (!result.success) {
      return NextResponse.json({ message: result.message }, { status: 400 });
    }
    return NextResponse.json({
      message:
        result.claimedCount > 0
          ? `문의가 연결되었습니다. 후기 자격 ${result.claimedCount}건이 부여되었습니다.`
          : "문의가 연결되었습니다.",
      claimedCount: result.claimedCount,
    });
  }

  const customerProfileId = body.customer_profile_id?.trim();
  if (!customerProfileId) {
    return NextResponse.json(
      { message: "customer_profile_id 또는 inquiry_id를 지정해 주세요." },
      { status: 400 },
    );
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("customer_profiles")
    .select("id")
    .eq("id", customerProfileId)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ message: "고객 프로필을 찾을 수 없습니다." }, { status: 404 });
  }

  await linkMemberToCustomerProfile(memberId, customerProfileId, {
    linked_by: "admin",
    verified_method: "admin_manual",
  });

  const claimedCount = await autoClaimEligibilitiesForMember(memberId, customerProfileId);

  return NextResponse.json({
    message:
      claimedCount > 0
        ? `고객 프로필이 연결되었습니다. 후기 자격 ${claimedCount}건이 부여되었습니다.`
        : "고객 프로필이 연결되었습니다.",
    claimedCount,
  });
}
