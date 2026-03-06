import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { supabase } from "@/lib/supabase";
import type { HomeCuratedSectionWithCount } from "@/types/homeCurated";

type SectionBody = {
  title?: string;
  description?: string;
  max_items?: number;
  sort_order?: number;
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

export async function POST(request: Request) {
  const { data: settingRow, error: settingError } = await supabase
    .from("home_curated_settings")
    .select("id")
    .eq("setting_key", "home_curated")
    .maybeSingle();

  if (settingError || !settingRow) {
    return NextResponse.json({ message: "추천 설정을 찾을 수 없습니다." }, { status: 400 });
  }

  const settingId = settingRow.id;
  const body = (await request.json()) as SectionBody;

  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const maxItems = typeof body.max_items === "number" ? Math.max(0, body.max_items) : 8;
  const sortOrder = typeof body.sort_order === "number" ? body.sort_order : 0;
  const isActive = body.is_active ?? true;

  const insertResult = await supabase
    .from("home_curated_sections")
    .insert({
      setting_id: settingId,
      title: title || "새 섹션",
      description,
      sort_order: sortOrder,
      max_items: maxItems,
      is_active: isActive,
    })
    .select("*")
    .maybeSingle();

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json({ message: "섹션 추가에 실패했습니다." }, { status: 500 });
  }

  revalidateTag(CACHE_TAGS.HOME_CURATED, REVALIDATE_MAX);
  revalidatePath("/");
  const row = insertResult.data as Record<string, unknown>;
  return NextResponse.json(normalizeSection(row, 0), { status: 201 });
}
