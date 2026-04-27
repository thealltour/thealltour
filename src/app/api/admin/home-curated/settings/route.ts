import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SettingsBody = {
  section_label?: string;
  section_title?: string;
  section_description?: string;
  catalog_button_label?: string;
  catalog_button_href?: string;
  is_active?: boolean;
};

export async function PATCH(request: Request) {
  const body = (await request.json()) as SettingsBody;
  const updates: Record<string, unknown> = {};

  if (body.section_label !== undefined) {
    updates.section_label = String(body.section_label ?? "").trim();
  }
  if (body.section_title !== undefined) {
    updates.section_title = String(body.section_title ?? "").trim();
  }
  if (body.section_description !== undefined) {
    updates.section_description = String(body.section_description ?? "").trim();
  }
  if (body.catalog_button_label !== undefined) {
    updates.catalog_button_label = String(body.catalog_button_label ?? "").trim();
  }
  if (body.catalog_button_href !== undefined) {
    updates.catalog_button_href = String(body.catalog_button_href ?? "/products").trim() || "/products";
  }
  if (body.is_active !== undefined) {
    updates.is_active = Boolean(body.is_active);
  }

  updates.updated_at = new Date().toISOString();

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ message: "변경할 항목이 없습니다." }, { status: 400 });
  }

  const result = await supabaseAdmin
    .from("home_curated_settings")
    .update(updates)
    .eq("setting_key", "home_curated")
    .select("id")
    .maybeSingle();

  if (result.error) {
    return NextResponse.json({ message: "설정 수정에 실패했습니다." }, { status: 500 });
  }

  if (!result.data) {
    const insertPayload = {
      setting_key: "home_curated",
      section_label: String(body.section_label ?? "").trim(),
      section_title: String(body.section_title ?? "").trim(),
      section_description: String(body.section_description ?? "").trim(),
      catalog_button_label: String(body.catalog_button_label ?? "").trim(),
      catalog_button_href: (body.catalog_button_href ?? "/products").trim() || "/products",
      is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
    };
    const insertResult = await supabaseAdmin
      .from("home_curated_settings")
      .upsert(insertPayload, { onConflict: "setting_key" })
      .select("id")
      .maybeSingle();
    if (insertResult.error || !insertResult.data) {
      return NextResponse.json({ message: "설정 저장에 실패했습니다. (초기 설정 행 생성 실패)" }, { status: 500 });
    }
  }

  revalidateTag(CACHE_TAGS.HOME_CURATED, REVALIDATE_MAX);
  revalidatePath("/");
  return NextResponse.json({ message: "설정이 저장되었습니다." });
}
