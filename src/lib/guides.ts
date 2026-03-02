import { supabase } from "@/lib/supabase";
import type { Guide } from "@/types/guide";
import { unstable_cache } from "next/cache";

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
    seo_title: typeof (row as any).seo_title === "string" ? ((row as any).seo_title as string) : null,
    seo_description:
      typeof (row as any).seo_description === "string" ? ((row as any).seo_description as string) : null,
    focus_keyword:
      typeof (row as any).focus_keyword === "string" ? ((row as any).focus_keyword as string) : null,
  };
}

// 유저 여행가이드(/blog) 통합 목록: PDF/Notion 모두 노출
export async function getPublishedGuides(): Promise<Guide[]> {
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    return [];
  }

  return (data ?? []).map((row) => normalizeGuide(row as Record<string, unknown>));
}

// Notion 기반 상세 페이지(/guides)용: slug와 notion_page_id가 있는 가이드만
export async function getPublishedNotionGuides(): Promise<Guide[]> {
  return unstable_cache(
    async () => {
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
    },
    ["guides-notion-list"],
    {
      revalidate: 60 * 60 * 3,
      tags: ["guides:list"],
    },
  )();
}

