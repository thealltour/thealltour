import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMemberSessionFromCookies, type MemberSessionPayload } from "@/lib/memberSession";
import { ADMIN_AUTH_COOKIE } from "@/lib/adminAuth";

/** 회원 인증 필수. 실패 시 401 반환. */
export async function requireMemberSession(): Promise<
  { session: MemberSessionPayload; res: null } | { session: null; res: NextResponse }
> {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) {
    return { session: null, res: NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 }) };
  }
  return { session, res: null };
}

/** 관리자 인증 필수. 실패 시 401 반환. */
export async function requireAdminSession(): Promise<
  { ok: true } | { ok: false; res: NextResponse }
> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_AUTH_COOKIE)?.value;
  if (!token || token !== "1") {
    return { ok: false, res: NextResponse.json({ message: "관리자 로그인이 필요합니다." }, { status: 401 }) };
  }
  return { ok: true };
}
