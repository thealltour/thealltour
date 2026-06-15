import { NextResponse } from "next/server";
import { MEMBER_AUTH_COOKIE } from "@/lib/memberSession";
import { loginMemberWithCredentials } from "@/lib/members/loginMember";

type LoginBody = {
  username?: string;
  identifier?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LoginBody;
  const result = await loginMemberWithCredentials({
    username: body.username,
    identifier: body.identifier,
    password: body.password ?? "",
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  const response = NextResponse.json({ message: "로그인되었습니다." });
  response.cookies.set(MEMBER_AUTH_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
