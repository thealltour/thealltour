import { supabase } from "@/lib/supabase";
import type { Guide } from "@/types/guide";
import { unstable_cache } from "next/cache";
import { getTaxonomyById } from "@/lib/productTaxonomies";

function safeUuidOrNull(value: unknown): string | null {
  if (value == null) return null;
  const s = typeof value === "string" ? value.trim() : String(value).trim();
  return s === "" ? null : s;
}

/** 가이드 브리지 추천용: 제목/요약 등에서 뽑은 토큰의 불용어(일반어) */
const GUIDE_BRIDGE_STOPWORDS = new Set([
  "여행",
  "가이드",
  "추천",
  "정보",
  "정리",
  "최신",
  "보기",
  "투어",
  "코스",
  "전체",
  "방법",
  "소개",
  "준비",
  "출발",
  "비용",
  "가격",
  "어디",
  "좋은",
  "하기",
  "위한",
  "관련",
  "확인",
  "선택",
  "예약",
  "the",
  "and",
  "for",
  "with",
]);

function shouldKeepGuideBridgeToken(tok: string): boolean {
  if (!tok) return false;
  if (/^\d+$/.test(tok)) return false;
  const hasCjk = /[\u3000-\u9fff\uac00-\ud7af]/.test(tok);
  if (hasCjk) return tok.length >= 2;
  return tok.length >= 3;
}

/**
 * 브리지 추천 점수용 검색 토큰. 불용어·짧은 토큰·숫자 제거 후 지역/테마 앵커는 보존.
 * @param anchors taxonomy에서 온 지역·테마 표기(소문자), 고유명 검색에 포함
 */
export function extractGuideBridgeSearchTokens(
  guide: Guide,
  anchors?: { destinationLower?: string | null; themeLower?: string | null },
): string[] {
  const pieces: string[] = [];
  for (const t of [guide.title_override, guide.title, guide.summary, guide.category]) {
    if (typeof t === "string" && t.trim()) pieces.push(t);
  }
  if (Array.isArray(guide.tags)) {
    for (const tag of guide.tags) {
      if (typeof tag === "string" && tag.trim()) pieces.push(tag);
    }
  }
  const raw = pieces.join(" ");
  const split = raw
    .split(/[\s,./·|[\]()"'`／、，\-_]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const out = new Set<string>();
  for (const tok of split) {
    if (!shouldKeepGuideBridgeToken(tok)) continue;
    if (GUIDE_BRIDGE_STOPWORDS.has(tok)) continue;
    out.add(tok);
  }

  const addAnchor = (s: string | null | undefined) => {
    const v = s?.trim().toLowerCase();
    if (!v) return;
    for (const part of v.split(/[/|·,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean)) {
      if (!shouldKeepGuideBridgeToken(part)) continue;
      if (GUIDE_BRIDGE_STOPWORDS.has(part)) continue;
      out.add(part);
    }
  };
  addAnchor(anchors?.destinationLower);
  addAnchor(anchors?.themeLower);

  return [...out];
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

// 유저 여행가이드(/guides) 통합 목록: PDF/Notion 모두 노출. limit 있으면 해당 건수만.
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

/**
 * /guides 여행가이드 목록과 동일한 정렬·풀(getPublishedGuidesWithTaxonomyNames)에서 slug 기준 이전·다음.
 * (sort_order asc → published_at desc → created_at desc)
 */
export async function getAdjacentPublishedGuidesBySlug(
  slug: string,
): Promise<{ prev: Guide | null; next: Guide | null }> {
  const orderedGuides = await getPublishedGuidesWithTaxonomyNames();
  const s = slug.trim();
  const idx = orderedGuides.findIndex((g) => (g.slug ?? "").trim() === s);
  if (idx < 0) return { prev: null, next: null };
  return {
    prev: idx > 0 ? orderedGuides[idx - 1]! : null,
    next: idx < orderedGuides.length - 1 ? orderedGuides[idx + 1]! : null,
  };
}

/**
 * 브리지(/guides/[slug]) 하단 연관 가이드: /guides와 동일한 공개 풀·정렬을 베이스로,
 * 동일 destination/theme 우선, 나머지는 목록 순서를 유지해 채움 (노션 전용 /guides 목록과 무관).
 */
export async function getRelatedGuidesForBlogBridge(guide: Guide, limit = 4): Promise<Guide[]> {
  const allOrdered = await getPublishedGuidesWithTaxonomyNames();
  const excludeId = guide.id;
  const destinationId = guide.destination_id?.trim() || null;
  const themeId = guide.theme_id?.trim() || null;

  const indexMap = new Map(allOrdered.map((g, i) => [g.id, i]));

  const entries = allOrdered
    .filter((g) => g.id !== excludeId)
    .map((g) => {
      let rank = 0;
      if (destinationId && g.destination_id === destinationId) rank += 2;
      if (themeId && g.theme_id === themeId) rank += 1;
      return { g, rank, idx: indexMap.get(g.id) ?? 0 };
    });

  entries.sort((a, b) => {
    if (b.rank !== a.rank) return b.rank - a.rank;
    return a.idx - b.idx;
  });

  return entries.slice(0, limit).map((e) => e.g);
}

/** 브리지 하단: 현재 가이드 제외 + 추가 제외 ID 이후 상위 limit건 (/guides 동일 풀·정렬) */
export async function getMoreGuidesForBridge(
  excludeId: string,
  alsoExcludeIds: string[],
  limit = 8,
): Promise<Guide[]> {
  const exclude = new Set([excludeId, ...alsoExcludeIds]);
  const all = await getPublishedGuidesWithTaxonomyNames();
  return all.filter((g) => !exclude.has(g.id)).slice(0, limit);
}

/**
 * 노션 원문 URL. notion_url 우선, 없으면 notion_page_id로 https://notion.so/{hex} 생성.
 * /guides 목록·홈 가이드 섹션 등 외부 노션 열기에 공통 사용.
 */
export function getGuideNotionViewUrl(guide: Guide): string {
  const url = guide.notion_url?.trim();
  if (url) return url;
  const pageId = guide.notion_page_id?.trim();
  if (pageId) {
    const hex = pageId.replace(/-/g, "");
    return `https://notion.so/${hex}`;
  }
  return "";
}

/** 가이드 카드/상세 링크. slug 있으면 /guides/[slug] 브리지, 없으면 landing_url, 없으면 사용자 목록 /guides */
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

