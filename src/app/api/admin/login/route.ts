import { NextResponse } from "next/server";
import { ADMIN_AUTH_COOKIE, getAdminId, getAdminPassword } from "@/lib/adminAuth";

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

  const response = NextResponse.json({ message: "로그인되었습니다." });
  response.cookies.set(ADMIN_AUTH_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}
