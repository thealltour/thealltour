import { supabase } from "@/lib/supabase";
import type { Guide } from "@/types/guide";
import { unstable_cache } from "next/cache";
import { getTaxonomyById } from "@/lib/productTaxonomies";

function safeUuidOrNull(value: unknown): string | null {
  if (value == null) return null;
  const s = typeof value === "string" ? value.trim() : String(value).trim();
  return s === "" ? null : s;
}

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
    destination_id: safeUuidOrNull((row as any).destination_id),
    theme_id: safeUuidOrNull((row as any).theme_id),
    destination_name: typeof (row as any).destination_name === "string" ? ((row as any).destination_name as string) : null,
    theme_name: typeof (row as any).theme_name === "string" ? ((row as any).theme_name as string) : null,
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

// 유저 여행가이드(/blog) 통합 목록: PDF/Notion 모두 노출. limit 있으면 해당 건수만.
// 정렬: sort_order asc → published_at desc → created_at desc
export async function getPublishedGuides(limit?: number): Promise<Guide[]> {
  let query = supabase
    .from("guides")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });
  if (typeof limit === "number" && limit > 0) {
    query = query.limit(limit);
  }
  const { data, error } = await query;

  if (error) {
    return [];
  }

  return (data ?? []).map((row) => normalizeGuide(row as Record<string, unknown>));
}

/** 홈 페이지용: 발행 가이드 최대 limit건 + destination_id/theme_id에 대해 지역·테마명 채움 (카드 뱃지용). */
export async function getHomeGuidesWithTaxonomyNames(limit = 4): Promise<Guide[]> {
  return getPublishedGuidesWithTaxonomyNames(limit);
}

/** 발행 가이드 조회 + destination_id/theme_id에 대해 지역·테마명 채움 (카드 뱃지용). limit 없으면 전체. */
export async function getPublishedGuidesWithTaxonomyNames(limit?: number): Promise<Guide[]> {
  const guides = await getPublishedGuides(limit);
  const destIds = [...new Set(guides.map((g) => g.destination_id).filter(Boolean))] as string[];
  const themeIds = [...new Set(guides.map((g) => g.theme_id).filter(Boolean))] as string[];
  const [destMap, themeMap] = await Promise.all([
    Promise.all(destIds.map((id) => getTaxonomyById(id))).then((list) =>
      new Map(list.map((t, i) => [destIds[i], t?.name ?? null])),
    ),
    Promise.all(themeIds.map((id) => getTaxonomyById(id))).then((list) =>
      new Map(list.map((t, i) => [themeIds[i], t?.name ?? null])),
    ),
  ]);
  return guides.map((g) => ({
    ...g,
    destination_name: g.destination_id ? (destMap.get(g.destination_id) ?? null) : null,
    theme_name: g.theme_id ? (themeMap.get(g.theme_id) ?? null) : null,
  }));
}

/** 홈 페이지용: 발행된 가이드 최대 4건. published_at 우선 정렬, 없으면 created_at. */
export async function getHomeGuides(limit = 4): Promise<Guide[]> {
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    return [];
  }

  return (data ?? []).map((row) => normalizeGuide(row as Record<string, unknown>));
}

/** destination 랜딩용: 해당 destination_id로 연결된 발행 가이드. sort_order asc → published_at desc → created_at desc. */
export async function getGuidesByDestinationId(
  destinationId: string,
  limit = 4,
): Promise<Guide[]> {
  const id = destinationId?.trim();
  if (!id) return [];
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("is_published", true)
    .eq("destination_id", id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((row) => normalizeGuide(row as Record<string, unknown>));
}

/** theme 랜딩용: 해당 theme_id로 연결된 발행 가이드. sort_order asc → published_at desc → created_at desc. */
export async function getGuidesByThemeId(themeId: string, limit = 4): Promise<Guide[]> {
  const id = themeId?.trim();
  if (!id) return [];
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("is_published", true)
    .eq("theme_id", id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((row) => normalizeGuide(row as Record<string, unknown>));
}

/** slug로 공개 가이드 1건 조회. is_published = true. */
export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  const s = slug?.trim();
  if (!s) return null;
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("is_published", true)
    .eq("slug", s)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeGuide(data as Record<string, unknown>);
}

/** 가이드 상세용: 동일 destination_id 또는 theme_id로 연결된 다른 가이드. 현재 가이드 제외, limit 기본 4. */
export async function getRelatedGuidesByGuide(
  guide: Guide,
  limit = 4,
): Promise<Guide[]> {
  const destinationId = guide.destination_id?.trim() || null;
  const themeId = guide.theme_id?.trim() || null;
  const excludeId = guide.id;

  if (!destinationId && !themeId) {
    return getPublishedGuides(limit + 1).then((list) =>
      list.filter((g) => g.id !== excludeId).slice(0, limit),
    );
  }

  const orConditions: string[] = [];
  if (destinationId) orConditions.push(`destination_id.eq.${destinationId}`);
  if (themeId) orConditions.push(`theme_id.eq.${themeId}`);

  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("is_published", true)
    .neq("id", excludeId)
    .or(orConditions.join(","))
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((row) => normalizeGuide(row as Record<string, unknown>));
}

/** 가이드 카드/상세 링크. slug 있으면 /guides/[slug] 우선, 없으면 landing_url, 없으면 /guides */
export function getGuideHref(guide: Guide): string {
  if (guide.slug?.trim()) return `/guides/${encodeURIComponent(guide.slug.trim())}`;
  if (guide.landing_url?.trim()) return guide.landing_url.trim();
  return "/guides";
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

/** /guides 목록 검색: q가 있으면 title, summary ilike 검색. 없으면 getPublishedNotionGuides()와 동일 조건. */
export async function getPublishedNotionGuidesWithSearch(q?: string | null): Promise<Guide[]> {
  const term = q?.trim();
  if (!term) return getPublishedNotionGuides();

  const pattern = `%${term}%`;
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("is_published", true)
    .not("slug", "is", null)
    .not("notion_page_id", "is", null)
    .or(`title.ilike.${pattern},summary.ilike.${pattern}`)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) return [];
  return (data ?? []).map((row) => normalizeGuide(row as Record<string, unknown>));
}

