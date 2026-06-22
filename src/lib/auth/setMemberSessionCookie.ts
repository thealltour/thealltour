import { NextResponse } from "next/server";
import { createMemberSessionToken, MEMBER_AUTH_COOKIE } from "@/lib/memberSession";
import {
  getMemberSessionCookieOptions,
  resolveMemberSessionMaxAgeSec,
} from "@/lib/memberSessionPolicy";
import type { MemberRowForAuth } from "@/lib/auth/types";

export function appendMemberSessionCookie(
  response: NextResponse,
  member: Pick<MemberRowForAuth, "id" | "username" | "name">,
  options?: { rememberMe?: boolean },
) {
  const token = createMemberSessionToken({
    memberId: String(member.id),
    username: String(member.username),
    name: String(member.name),
  });
  const maxAge = resolveMemberSessionMaxAgeSec(options?.rememberMe ?? true);
  response.cookies.set(MEMBER_AUTH_COOKIE, token, getMemberSessionCookieOptions(maxAge));
}
