import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type PatchBody = {
  is_completed?: boolean;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as PatchBody;

  if (typeof body.is_completed !== "boolean") {
    return NextResponse.json(
      { message: "is_completed는 boolean 값이어야 합니다." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("inquiries")
    .update({ is_completed: body.is_completed })
    .eq("id", id);

  if (error) {
    const errorCode = error?.code;
    if (errorCode === "42703") {
      return NextResponse.json(
        { message: "inquiries 테이블에 is_completed 컬럼이 없습니다. DB 업그레이드 SQL을 실행해 주세요." },
        { status: 500 },
      );
    }
    if (errorCode === "42501") {
      return NextResponse.json(
        { message: "inquiries 테이블 UPDATE 권한(RLS 정책)이 없습니다. 정책 SQL을 확인해 주세요." },
        { status: 500 },
      );
    }
    return NextResponse.json({ message: "상담 상태 업데이트에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ message: "상담 상태가 업데이트되었습니다." });
}
