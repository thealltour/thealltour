import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getMemberReviewEligibilitySummary } from "@/lib/admin/memberReviewEligibilities";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: memberId } = await context.params;

  const { data: member, error } = await supabaseAdmin
    .from("members")
    .select("id, phone")
    .eq("id", memberId)
    .maybeSingle();

  if (error || !member) {
    return NextResponse.json({ message: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  const summary = await getMemberReviewEligibilitySummary(memberId, String(member.phone ?? ""));

  return NextResponse.json(summary);
}
