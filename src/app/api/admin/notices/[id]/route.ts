import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type NoticeBody = {
  title?: string;
  content?: string;
  is_published?: boolean;
  sort_order?: number | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const body = (await request.json()) as NoticeBody;

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ message: "제목을 입력해 주세요." }, { status: 400 });
    updates.title = title;
  }
  if (body.content !== undefined) {
    const content = body.content.trim();
    if (!content) return NextResponse.json({ message: "내용을 입력해 주세요." }, { status: 400 });
    updates.content = content;
  }
  if (body.is_published !== undefined) updates.is_published = body.is_published;
  if (body.sort_order !== undefined) {
    updates.sort_order = typeof body.sort_order === "number" ? body.sort_order : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "변경할 항목이 없습니다." }, { status: 400 });
  }

  const updateResult = await supabaseAdmin
    .from("notices")
    .update(updates)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (updateResult.error || !updateResult.data) {
    return NextResponse.json({ message: "공지 수정에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ message: "공지가 수정되었습니다." });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const deleteResult = await supabaseAdmin.from("notices").delete().eq("id", id).select("id").maybeSingle();
  if (deleteResult.error || !deleteResult.data) {
    return NextResponse.json({ message: "공지 삭제에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ message: "공지가 삭제되었습니다." });
}
