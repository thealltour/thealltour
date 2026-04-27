import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { HomeCuratedSettings, HomeCuratedSectionWithCount } from "@/types/homeCurated";

function normalizeSettings(row: Record<string, unknown>): HomeCuratedSettings {
  return {
    id: String(row.id ?? ""),
    setting_key: String(row.setting_key ?? ""),
    section_label: String(row.section_label ?? ""),
    section_title: String(row.section_title ?? ""),
    section_description: String(row.section_description ?? ""),
    catalog_button_label: String(row.catalog_button_label ?? ""),
    catalog_button_href: String(row.catalog_button_href ?? "/products"),
    is_active: row.is_active === true,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

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

export async function GET() {
  const { data: settingRow, error: settingError } = await supabaseAdmin
    .from("home_curated_settings")
    .select("*")
    .eq("setting_key", "home_curated")
    .maybeSingle();

  if (settingError) {
    return NextResponse.json({ message: "설정 조회에 실패했습니다." }, { status: 500 });
  }

  const settings = settingRow
    ? normalizeSettings(settingRow as Record<string, unknown>)
    : null;

  if (!settingRow) {
    return NextResponse.json({ settings: null, sections: [] });
  }

  const settingId = String(settingRow.id);

  const { data: sectionRows, error: sectionsError } = await supabaseAdmin
    .from("home_curated_sections")
    .select("*")
    .eq("setting_id", settingId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (sectionsError) {
    return NextResponse.json({ message: "섹션 목록 조회에 실패했습니다." }, { status: 500 });
  }

  const sections = sectionRows ?? [];
  const sectionIds = sections.map((s: { id: string }) => s.id);

  let counts: Record<string, number> = {};
  if (sectionIds.length > 0) {
    const { data: countRows } = await supabaseAdmin
      .from("home_curated_section_products")
      .select("section_id")
      .in("section_id", sectionIds)
      .eq("is_active", true);
    const list = countRows ?? [];
    for (const r of list) {
      const sid = String(r.section_id);
      counts[sid] = (counts[sid] ?? 0) + 1;
    }
  }

  const sectionsWithCount: HomeCuratedSectionWithCount[] = sections.map((row: Record<string, unknown>) =>
    normalizeSection(row, counts[String(row.id)] ?? 0),
  );

  return NextResponse.json({ settings, sections: sectionsWithCount });
}
