import { NextResponse } from "next/server";
import { ADMIN_AUTH_COOKIE, getAdminId, getAdminPassword } from "@/lib/adminAuth";
import { ADMIN_SESSION_MAX_AGE_SEC, createAdminSessionToken } from "@/lib/adminSession";

type LoginBody = {
  id?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LoginBody;
  const id = body.id?.trim();
  const password = body.password?.trim();
  const adminId = getAdminId();
  const adminPassword = getAdminPassword();

  if (!adminId || !adminPassword) {
    return NextResponse.json(
      { message: "서버에 ADMIN_ID/ADMIN_PASSWORD가 설정되어 있지 않습니다." },
      { status: 500 },
    );
  }

  if (!id || !password || id !== adminId || password !== adminPassword) {
    return NextResponse.json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  let token: string;
  try {
    token = await createAdminSessionToken();
  } catch (e) {
    const message = e instanceof Error ? e.message : "관리자 세션을 발급할 수 없습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }

  const response = NextResponse.json({ message: "로그인되었습니다." });
  response.cookies.set(ADMIN_AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SEC,
  });

  return response;
}
