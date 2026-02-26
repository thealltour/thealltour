import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { Guide } from "@/types/guide";

type GuideBody = Partial<
  Pick<Guide, "title" | "summary" | "thumbnail_url" | "landing_url" | "is_published" | "sort_order">
>;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ message: "가이드 ID가 올바르지 않습니다." }, { status: 400 });
  }

  const body = (await request.json()) as GuideBody;
  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.summary !== undefined) updates.summary = body.summary.trim();
  if (body.thumbnail_url !== undefined) updates.thumbnail_url = body.thumbnail_url.trim();
  if (body.landing_url !== undefined) updates.landing_url = body.landing_url.trim();
  if (body.is_published !== undefined) updates.is_published = body.is_published;
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

  if (!Object.keys(updates).length) {
    return NextResponse.json({ message: "수정할 항목이 없습니다." }, { status: 400 });
  }

  const { error } = await supabase.from("guides").update(updates).eq("id", id);
  if (error) {
    return NextResponse.json({ message: "여행가이드 수정에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ message: "여행가이드가 수정되었습니다." });
}

export async function DELETE(_: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ message: "가이드 ID가 올바르지 않습니다." }, { status: 400 });
  }

  const { error } = await supabase.from("guides").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ message: "여행가이드 삭제에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ message: "여행가이드가 삭제되었습니다." });
}

