import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * 로그인 회원 프로필.
 * 비회원도 200 + authenticated:false — 콘솔 401 노이즈/게스트 폴링 스팸 방지.
 * 세션이 있으면 항상 200 — DB 조회 실패 시에도 세션 name으로 폴백.
 */
export async function GET() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      name: "",
      phone: "",
      email: "",
    });
  }

  const userId = session.memberId;
  const { data, error } = await supabaseAdmin
    .from("members")
    .select("name, phone, email")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[me/profile]", error.message);
  }

  const name =
    (typeof data?.name === "string" && data.name.trim()) || session.name.trim() || "";
  const phone = typeof data?.phone === "string" ? data.phone.trim() : "";
  const email = typeof data?.email === "string" ? data.email.trim() : "";

  return NextResponse.json({
    authenticated: true,
    name,
    phone,
    email,
  });
}
