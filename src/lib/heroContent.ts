import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import type { HomeHeroContent } from "@/types/homeHeroContent";
import { DEFAULT_HERO_CONTENT } from "@/types/homeHeroContent";

function normalize(row: Record<string, unknown> | null): HomeHeroContent | null {
  if (!row) return null;
  return {
    id: String(row.id ?? ""),
    badge: typeof row.badge === "string" ? row.badge : null,
    main_copy_accent: typeof row.main_copy_accent === "string" ? row.main_copy_accent : null,
    main_copy_tail: typeof row.main_copy_tail === "string" ? row.main_copy_tail : null,
    sub_description: typeof row.sub_description === "string" ? row.sub_description : null,
    bullet_1: typeof row.bullet_1 === "string" ? row.bullet_1 : null,
    bullet_2: typeof row.bullet_2 === "string" ? row.bullet_2 : null,
    bullet_3: typeof row.bullet_3 === "string" ? row.bullet_3 : null,
    recommended_text: typeof row.recommended_text === "string" ? row.recommended_text : null,
    search_placeholder: typeof row.search_placeholder === "string" ? row.search_placeholder : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

/** 공개용: 캐시된 히어로 문구 1건 (없으면 null) */
export async function getHeroContent(): Promise<HomeHeroContent | null> {
  return getHeroContentCached();
}

const getHeroContentCached = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("home_hero_content")
      .select("*")
      .limit(1)
      .order("created_at", { ascending: true })
      .maybeSingle();

    return normalize((data ?? null) as Record<string, unknown> | null);
  },
  ["home-hero-content"],
  { revalidate: 10, tags: ["home-hero-content"] },
);

/** 기본값 포함한 문구 반환 (공개 페이지용) */
export function resolveHeroContent(content: HomeHeroContent | null) {
  if (!content)
    return {
      badge: DEFAULT_HERO_CONTENT.badge,
      main_copy_accent: DEFAULT_HERO_CONTENT.main_copy_accent,
      main_copy_tail: DEFAULT_HERO_CONTENT.main_copy_tail,
      sub_description: DEFAULT_HERO_CONTENT.sub_description,
      bullet_1: DEFAULT_HERO_CONTENT.bullet_1,
      bullet_2: DEFAULT_HERO_CONTENT.bullet_2,
      bullet_3: DEFAULT_HERO_CONTENT.bullet_3,
      recommended_text: DEFAULT_HERO_CONTENT.recommended_text,
      search_placeholder: DEFAULT_HERO_CONTENT.search_placeholder,
    };
  return {
    badge: content.badge ?? DEFAULT_HERO_CONTENT.badge,
    main_copy_accent: content.main_copy_accent ?? DEFAULT_HERO_CONTENT.main_copy_accent,
    main_copy_tail: content.main_copy_tail ?? DEFAULT_HERO_CONTENT.main_copy_tail,
    sub_description: content.sub_description ?? DEFAULT_HERO_CONTENT.sub_description,
    bullet_1: content.bullet_1 ?? DEFAULT_HERO_CONTENT.bullet_1,
    bullet_2: content.bullet_2 ?? DEFAULT_HERO_CONTENT.bullet_2,
    bullet_3: content.bullet_3 ?? DEFAULT_HERO_CONTENT.bullet_3,
    recommended_text: content.recommended_text ?? DEFAULT_HERO_CONTENT.recommended_text,
    search_placeholder: content.search_placeholder ?? DEFAULT_HERO_CONTENT.search_placeholder,
  };
}
