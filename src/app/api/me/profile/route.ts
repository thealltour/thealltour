import { NextResponse } from "next/server";
import { requireMemberSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * 로그인 회원 프로필.
 * 세션이 있으면 항상 200 — DB 조회 실패 시에도 세션 name으로 폴백해
 * 결제 모달이 비회원 UI로 떨어지지 않게 한다.
 */
export async function GET() {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;
  const userId = auth.session.memberId;

  const { data, error } = await supabaseAdmin
    .from("members")
    .select("name, phone, email")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[me/profile]", error.message);
  }

  const name =
    (typeof data?.name === "string" && data.name.trim()) || auth.session.name.trim() || "";
  const phone = typeof data?.phone === "string" ? data.phone.trim() : "";
  const email = typeof data?.email === "string" ? data.email.trim() : "";

  return NextResponse.json({ name, phone, email });
}
