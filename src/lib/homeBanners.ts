import { supabase } from "@/lib/supabase";
import type { HomeBanner } from "@/types/homeBanner";

function normalizeBanner(row: Record<string, unknown>): HomeBanner {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? "메인 배너"),
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

export async function getHomeBanners() {
  const result = await supabase
    .from("home_banners")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (result.error) return [] as HomeBanner[];
  return (result.data ?? []).map((row) => normalizeBanner(row as Record<string, unknown>));
}
