import { NextResponse } from "next/server";
import { MEMBER_AUTH_COOKIE } from "@/lib/memberSession";
import { registerMemberQuick } from "@/lib/members/registerQuick";
import type { QuickRegisterInput } from "@/lib/members/registerQuick";

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<QuickRegisterInput>;
  const result = await registerMemberQuick({
    identifier: body.identifier ?? "",
    name: body.name ?? "",
    password: body.password ?? "",
    confirmPassword: body.confirmPassword ?? "",
    email: body.email,
    phone: body.phone,
    birthDate: body.birthDate ?? "",
    gender: body.gender ?? "male",
    agreeTerms: body.agreeTerms === true,
    agreePrivacy: body.agreePrivacy === true,
    agreeEmail: body.agreeEmail === true,
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  const response = NextResponse.json({ message: "회원가입이 완료되었습니다." }, { status: 201 });
  response.cookies.set(MEMBER_AUTH_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
