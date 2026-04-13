import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { supabase } from "@/lib/supabase";

type PatchBody = {
  sort_order?: number;
  is_active?: boolean;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; mappingId: string }> },
) {
  const { id: sectionId, mappingId } = await context.params;

  const existing = await supabase
    .from("home_curated_section_products")
    .select("id, section_id")
    .eq("id", mappingId)
    .eq("section_id", sectionId)
    .maybeSingle();

  if (existing.error || !existing.data) {
    return NextResponse.json({ message: "매핑을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = (await request.json()) as PatchBody;
  const updates: Record<string, unknown> = {};

  if (body.sort_order !== undefined) {
    updates.sort_order = typeof body.sort_order === "number" ? body.sort_order : 0;
  }
  if (body.is_active !== undefined) {
    updates.is_active = Boolean(body.is_active);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "변경할 항목이 없습니다." }, { status: 400 });
  }

  const result = await supabase
    .from("home_curated_section_products")
    .update(updates)
    .eq("id", mappingId)
    .select("*")
    .maybeSingle();

  if (result.error || !result.data) {
    return NextResponse.json({ message: "수정에 실패했습니다." }, { status: 500 });
  }

  revalidateTag(CACHE_TAGS.HOME_CURATED, REVALIDATE_MAX);
  revalidatePath("/");
  return NextResponse.json(result.data);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; mappingId: string }> },
) {
  const { id: sectionId, mappingId } = await context.params;

  const deleteResult = await supabase
    .from("home_curated_section_products")
    .delete()
    .eq("id", mappingId)
    .eq("section_id", sectionId)
    .select("id")
    .maybeSingle();

  if (deleteResult.error || !deleteResult.data) {
    return NextResponse.json({ message: "삭제에 실패했습니다." }, { status: 500 });
  }

  revalidateTag(CACHE_TAGS.HOME_CURATED, REVALIDATE_MAX);
  revalidatePath("/");
  return NextResponse.json({ message: "삭제되었습니다." });
}
