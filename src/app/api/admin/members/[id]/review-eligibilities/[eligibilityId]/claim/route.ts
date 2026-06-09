import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { adminClaimEligibilityById } from "@/lib/reviewEligibilities";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; eligibilityId: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: memberId, eligibilityId } = await context.params;

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("id")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError || !member) {
    return NextResponse.json({ message: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  const result = await adminClaimEligibilityById(eligibilityId, memberId);

  if (!result.success) {
    const messages: Record<string, string> = {
      not_found: "후기 자격을 찾을 수 없습니다.",
      already_submitted: "이미 후기가 작성된 건입니다.",
      already_claimed_by_other: "다른 회원에게 이미 부여된 권한입니다.",
      blocked: "차단된 후기 자격입니다.",
      expired: "만료된 후기 자격입니다.",
      unknown: "권한 부여에 실패했습니다.",
    };
    const status =
      result.error === "already_claimed_by_other" || result.error === "already_submitted" ? 409 : 400;
    return NextResponse.json({ message: messages[result.error] ?? "권한 부여에 실패했습니다." }, { status });
  }

  return NextResponse.json({
    message: "리뷰 작성 권한이 부여되었습니다. 회원 마이페이지에서 확인할 수 있습니다.",
    eligibility_id: result.eligibility_id,
  });
}
