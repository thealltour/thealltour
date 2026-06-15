import { NextResponse } from "next/server";
import { requireMemberSession } from "@/lib/apiAuth";
import { getMemberAuthSummary } from "@/lib/auth/memberAuthService";

export async function GET() {
  const auth = await requireMemberSession();
  if (!auth.session) return auth.res;

  try {
    const summary = await getMemberAuthSummary(auth.session.memberId);
    if (!summary) {
      return NextResponse.json({ message: "회원 정보를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[me/auth-providers]", err);
    return NextResponse.json({ message: "조회에 실패했습니다." }, { status: 500 });
  }
}
