import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMemberSessionFromCookies, type MemberSessionPayload } from "@/lib/memberSession";
import { ADMIN_AUTH_COOKIE } from "@/lib/adminAuth";
import { hasAdminPermission } from "@/lib/adminPermissions";
import { isInquiriesApiPath, isSessionAllowedForApiPath } from "@/lib/adminRolePolicy";
import type { AdminSessionPayload } from "@/lib/adminSession";
import type { AdminPermissionKey } from "@/lib/adminPermissions";
import { resolveAdminSessionFromToken } from "@/lib/adminSessionStore";

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
  { ok: true; session: AdminSessionPayload } | { ok: false; res: NextResponse }
> {
  return requireAdminSessionWithRole();
}

/** 관리자 인증 + 세션 반환 */
export async function requireAdminSessionWithRole(): Promise<
  { ok: true; session: AdminSessionPayload } | { ok: false; res: NextResponse }
> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_AUTH_COOKIE)?.value;
  const session = await resolveAdminSessionFromToken(token);
  if (!session) {
    return { ok: false, res: NextResponse.json({ message: "관리자 로그인이 필요합니다." }, { status: 401 }) };
  }
  return { ok: true, session };
}

/** 특정 권한 필요 (bootstrap admin bypass) */
export async function requireAdminPermission(
  permission: AdminPermissionKey,
): Promise<{ ok: true; session: AdminSessionPayload } | { ok: false; res: NextResponse }> {
  const auth = await requireAdminSessionWithRole();
  if (!auth.ok) return auth;
  if (!hasAdminPermission(auth.session, permission)) {
    return { ok: false, res: NextResponse.json({ message: "이 작업에 대한 권한이 없습니다." }, { status: 403 }) };
  }
  return auth;
}

/** API 경로에 대한 역할 허용 여부 */
export async function requireAdminSessionForPath(
  pathname: string,
): Promise<{ ok: true; session: AdminSessionPayload } | { ok: false; res: NextResponse }> {
  const auth = await requireAdminSessionWithRole();
  if (!auth.ok) return auth;
  if (!isSessionAllowedForApiPath(auth.session, pathname)) {
    return { ok: false, res: NextResponse.json({ message: "이 작업에 대한 권한이 없습니다." }, { status: 403 }) };
  }
  return auth;
}
