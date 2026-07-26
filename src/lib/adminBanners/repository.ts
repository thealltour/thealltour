import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { HomeBanner } from "@/types/homeBanner";

export type BannerWriteInput = {
  title?: string;
  image_url?: string;
  mobile_image_url?: string | null;
  link_url?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
};

export function normalizeBannerRow(row: Record<string, unknown>): HomeBanner {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    image_url: String(row.image_url ?? ""),
    mobile_image_url:
      typeof row.mobile_image_url === "string" && row.mobile_image_url.trim() !== ""
        ? row.mobile_image_url
        : null,
    link_url:
      typeof row.link_url === "string" && row.link_url.trim() !== "" ? row.link_url : null,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : null,
    is_active: typeof row.is_active === "boolean" ? row.is_active : true,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
  };
}

export async function listHomeBanners(): Promise<{ data: HomeBanner[] | null; errorMessage: string | null }> {
  const result = await supabaseAdmin
    .from("home_banners")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (result.error) {
    return { data: null, errorMessage: "배너 목록 조회에 실패했습니다." };
  }
  return {
    data: (result.data ?? []).map((row) => normalizeBannerRow(row as Record<string, unknown>)),
    errorMessage: null,
  };
}

export async function insertHomeBanner(input: {
  title: string;
  image_url: string;
  mobile_image_url: string | null;
  link_url: string | null;
  sort_order: number | null;
  is_active: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const insertResult = await supabaseAdmin
    .from("home_banners")
    .insert(input)
    .select("id")
    .maybeSingle();

  if (insertResult.error || !insertResult.data) {
    return { ok: false, message: "배너 추가에 실패했습니다." };
  }
  return { ok: true };
}

export async function updateHomeBanner(
  id: string,
  updates: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await supabaseAdmin
    .from("home_banners")
    .update(updates)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (result.error || !result.data) {
    return { ok: false, message: result.error?.message ?? "배너 수정에 실패했습니다." };
  }
  return { ok: true };
}

export async function deleteHomeBanner(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const deleteResult = await supabaseAdmin
    .from("home_banners")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (deleteResult.error || !deleteResult.data) {
    return { ok: false, message: deleteResult.error?.message ?? "배너 삭제에 실패했습니다." };
  }
  return { ok: true };
}
