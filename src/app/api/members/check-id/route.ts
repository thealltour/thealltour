import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{4,20}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const username = (url.searchParams.get("username") ?? "").trim();

  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json(
      { available: false, message: "아이디는 4~20자 영문/숫자/밑줄(_)만 가능합니다." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("members")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ available: false, message: "중복확인에 실패했습니다." }, { status: 500 });
  }

  const available = !data;
  return NextResponse.json({
    available,
    message: available ? "사용 가능한 아이디입니다." : "이미 사용 중인 아이디입니다.",
  });
}
