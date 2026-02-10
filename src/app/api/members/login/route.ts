import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyPassword } from "@/lib/password";
import { createMemberSessionToken, MEMBER_AUTH_COOKIE } from "@/lib/memberSession";

type LoginBody = {
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LoginBody;
  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";

  if (!username || !password) {
    return NextResponse.json({ message: "아이디와 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("members")
    .select("id,username,name,password_hash,password_salt")
    .eq("username", username)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const ok = verifyPassword(password, String(data.password_salt), String(data.password_hash));
  if (!ok) {
    return NextResponse.json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const token = createMemberSessionToken({
    memberId: String(data.id),
    username: String(data.username),
    name: String(data.name),
  });

  const response = NextResponse.json({ message: "로그인되었습니다." });
  response.cookies.set(MEMBER_AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
