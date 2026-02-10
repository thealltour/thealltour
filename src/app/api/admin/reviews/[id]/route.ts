import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type ReviewBody = {
  author_name?: string;
  title?: string;
  content?: string;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as ReviewBody;

  const updates: Record<string, unknown> = {};
  if (body.author_name !== undefined) updates.author_name = body.author_name.trim();
  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.content !== undefined) updates.content = body.content.trim();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "수정할 항목이 없습니다." }, { status: 400 });
  }

  const result = await supabase.from("reviews").update(updates).eq("id", id).select("id").maybeSingle();
  if (result.error) {
    return NextResponse.json({ message: "후기 수정에 실패했습니다." }, { status: 500 });
  }
  if (!result.data) {
    return NextResponse.json(
      { message: "후기 수정 권한이 없거나 대상 후기를 찾지 못했습니다." },
      { status: 403 },
    );
  }

  return NextResponse.json({ message: "후기가 수정되었습니다." });
}
