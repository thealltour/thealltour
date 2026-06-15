import { NextResponse } from "next/server";
import { requireMemberSession } from "@/lib/apiAuth";
import { completeMemberProfile } from "@/lib/auth/memberAuthService";
import { sanitizeNextPath } from "@/lib/auth/redirect";

type Body = {
  phone?: string;
  agreeTerms?: boolean;
  agreePrivacy?: boolean;
  next?: string;
};

export async function POST(request: Request) {
  const auth = await requireMemberSession();
  if (!auth.session) return auth.res;

  const body = (await request.json()) as Body;
  const phone = body.phone?.trim() ?? "";
  const agreeTerms = body.agreeTerms === true;
  const agreePrivacy = body.agreePrivacy === true;
  const next = sanitizeNextPath(body.next, "/mypage");

  if (!agreeTerms || !agreePrivacy) {
    return NextResponse.json({ message: "필수 약관에 동의해 주세요." }, { status: 400 });
  }

  try {
    const member = await completeMemberProfile(auth.session.memberId, {
      phone: phone || undefined,
      agreeTerms,
      agreePrivacy,
    });
    return NextResponse.json({
      message: "프로필이 저장되었습니다.",
      next,
      needsPhone: !member.phone?.trim(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "프로필 저장에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
