import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_AUTH_COOKIE } from "@/lib/adminAuth";
import { verifyAdminSessionJwt } from "@/lib/adminSession";
import { revokeAdminSession } from "@/lib/adminSessionStore";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_AUTH_COOKIE)?.value;
  const jwtPayload = await verifyAdminSessionJwt(token);
  if (jwtPayload?.sessionId) {
    try {
      await revokeAdminSession(jwtPayload.sessionId);
    } catch {
      // revoke 실패해도 쿠키는 삭제
    }
  }

  const response = NextResponse.json({ message: "로그아웃되었습니다." });
  response.cookies.set(ADMIN_AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
