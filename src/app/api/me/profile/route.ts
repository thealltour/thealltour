import { NextResponse } from "next/server";
import { requireMemberSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;
  const userId = auth.session.memberId;

  const { data, error } = await supabaseAdmin
    .from("members")
    .select("name, phone")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ message: "회원 정보를 불러올 수 없습니다." }, { status: 500 });
  }

  const name =
    (typeof data.name === "string" && data.name.trim()) || auth.session.name.trim() || "";
  const phone = typeof data.phone === "string" ? data.phone.trim() : "";

  return NextResponse.json({ name, phone });
}
