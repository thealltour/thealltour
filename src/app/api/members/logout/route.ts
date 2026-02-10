import { NextResponse } from "next/server";
import { MEMBER_AUTH_COOKIE } from "@/lib/memberSession";

export async function POST() {
  const response = NextResponse.json({ message: "로그아웃되었습니다." });
  response.cookies.set(MEMBER_AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
