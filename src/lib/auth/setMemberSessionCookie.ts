import { NextResponse } from "next/server";
import { createMemberSessionToken, MEMBER_AUTH_COOKIE } from "@/lib/memberSession";
import type { MemberRowForAuth } from "@/lib/auth/types";

export function appendMemberSessionCookie(response: NextResponse, member: Pick<MemberRowForAuth, "id" | "username" | "name">) {
  const token = createMemberSessionToken({
    memberId: String(member.id),
    username: String(member.username),
    name: String(member.name),
  });
  response.cookies.set(MEMBER_AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}
