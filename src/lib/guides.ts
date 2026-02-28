import { supabase } from "@/lib/supabase";
import type { Guide } from "@/types/guide";

function normalizeGuide(row: Record<string, unknown>): Guide {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    summary: typeof row.summary === "string" ? row.summary : undefined,
    thumbnail_url: typeof row.thumbnail_url === "string" ? row.thumbnail_url : undefined,
    landing_url: typeof row.landing_url === "string" ? row.landing_url : undefined,
    guide_pdf_url: typeof row.guide_pdf_url === "string" ? row.guide_pdf_url : undefined,
    guide_thumbnail_url: typeof row.guide_thumbnail_url === "string" ? row.guide_thumbnail_url : undefined,
    is_published: typeof row.is_published === "boolean" ? row.is_published : undefined,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : undefined,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

export async function getPublishedGuides(): Promise<Guide[]> {
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("is_published", true)
    .not("guide_pdf_url", "is", null)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    return [];
  }

  return (data ?? []).map((row) => normalizeGuide(row as Record<string, unknown>));
}

