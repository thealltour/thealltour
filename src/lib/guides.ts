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
    slug: typeof (row as any).slug === "string" ? ((row as any).slug as string) : null,
    notion_page_id:
      typeof (row as any).notion_page_id === "string" ? ((row as any).notion_page_id as string) : null,
    notion_url: typeof (row as any).notion_url === "string" ? ((row as any).notion_url as string) : null,
    title_override:
      typeof (row as any).title_override === "string" ? ((row as any).title_override as string) : null,
    cover_image_url:
      typeof (row as any).cover_image_url === "string" ? ((row as any).cover_image_url as string) : null,
    tags: Array.isArray((row as any).tags) ? (((row as any).tags as string[]) ?? null) : null,
    category: typeof (row as any).category === "string" ? ((row as any).category as string) : null,
    published_at:
      typeof (row as any).published_at === "string" ? ((row as any).published_at as string) : null,
    notion_last_edited_time:
      typeof (row as any).notion_last_edited_time === "string"
        ? ((row as any).notion_last_edited_time as string)
        : null,
    last_synced_at:
      typeof (row as any).last_synced_at === "string" ? ((row as any).last_synced_at as string) : null,
  };
}

// 기존 블로그(/blog)에서 사용하는 PDF 기반 가이드 목록
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

// Notion 기반 상세 페이지(/guides)용: slug와 notion_page_id가 있는 가이드만
export async function getPublishedNotionGuides(): Promise<Guide[]> {
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("is_published", true)
    .not("slug", "is", null)
    .not("notion_page_id", "is", null)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    return [];
  }

  return (data ?? []).map((row) => normalizeGuide(row as Record<string, unknown>));
}

