import { NextResponse } from "next/server";
import { MEMBER_AUTH_COOKIE } from "@/lib/memberSession";
import {
  getMemberSessionCookieOptions,
  resolveMemberSessionMaxAgeSec,
} from "@/lib/memberSessionPolicy";
import { loginMemberWithCredentials } from "@/lib/members/loginMember";

type LoginBody = {
  username?: string;
  identifier?: string;
  password?: string;
  rememberMe?: boolean;
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

  const maxAge = resolveMemberSessionMaxAgeSec(body.rememberMe);
  const response = NextResponse.json({ message: "로그인되었습니다." });
  response.cookies.set(
    MEMBER_AUTH_COOKIE,
    result.token,
    getMemberSessionCookieOptions(maxAge),
  );
  return response;
}
