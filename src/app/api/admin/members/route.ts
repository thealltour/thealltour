import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("members")
    .select("id,username,name,phone,email,birth_date,gender,agree_email,created_at")
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ message: "회원 목록 조회에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
