import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { supabase } from "@/lib/supabase";
import type { HomeCuratedSectionWithCount } from "@/types/homeCurated";

type SectionBody = {
  title?: string;
  description?: string;
  sort_order?: number;
  max_items?: number;
  is_active?: boolean;
};

function normalizeSection(row: Record<string, unknown>, productCount: number): HomeCuratedSectionWithCount {
  return {
    id: String(row.id ?? ""),
    setting_id: String(row.setting_id ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    max_items: typeof row.max_items === "number" ? Math.max(0, row.max_items) : 8,
    is_active: row.is_active === true,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    product_count: productCount,
  };
}

async function getProductCount(sectionId: string): Promise<number> {
  const { count } = await supabase
    .from("home_curated_section_products")
    .select("id", { count: "exact", head: true })
    .eq("section_id", sectionId)
    .eq("is_active", true);
  return count ?? 0;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const existing = await supabase
    .from("home_curated_sections")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (existing.error || !existing.data) {
    return NextResponse.json({ message: "섹션을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = (await request.json()) as SectionBody;
  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    updates.title = String(body.title ?? "").trim() || "제목 없음";
  }
  if (body.description !== undefined) {
    updates.description = String(body.description ?? "").trim();
  }
  if (body.sort_order !== undefined) {
    updates.sort_order = typeof body.sort_order === "number" ? body.sort_order : 0;
  }
  if (body.max_items !== undefined) {
    updates.max_items = Math.max(0, Number(body.max_items) || 8);
  }
  if (body.is_active !== undefined) {
    updates.is_active = Boolean(body.is_active);
  }

  if (Object.keys(updates).length === 0) {
    const count = await getProductCount(id);
    const { data: row } = await supabase
      .from("home_curated_sections")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (row) {
      return NextResponse.json(normalizeSection(row as Record<string, unknown>, count));
    }
    return NextResponse.json({ message: "변경할 항목이 없습니다." }, { status: 400 });
  }

  const result = await supabase
    .from("home_curated_sections")
    .update(updates)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (result.error || !result.data) {
    return NextResponse.json({ message: "섹션 수정에 실패했습니다." }, { status: 500 });
  }

  revalidateTag(CACHE_TAGS.HOME_CURATED, REVALIDATE_MAX);
  revalidatePath("/");
  const count = await getProductCount(id);
  return NextResponse.json(normalizeSection(result.data as Record<string, unknown>, count));
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const deleteResult = await supabase
    .from("home_curated_sections")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (deleteResult.error || !deleteResult.data) {
    return NextResponse.json({ message: "섹션 삭제에 실패했습니다." }, { status: 500 });
  }

  revalidateTag(CACHE_TAGS.HOME_CURATED, REVALIDATE_MAX);
  revalidatePath("/");
  return NextResponse.json({ message: "섹션이 삭제되었습니다." });
}
