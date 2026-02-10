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

  const { data, error } = await supabase
    .from("inquiries")
    .update({ is_completed: body.is_completed })
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ message: "상담 상태 업데이트에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ message: "상담 상태가 업데이트되었습니다." });
}
