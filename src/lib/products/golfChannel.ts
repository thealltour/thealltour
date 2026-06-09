import { buildProductsFilterHref } from "@/lib/productFilters";

/** /products 골프 채널 query param — 헤더·히어로·리드 UTM과 동일 규약 */
export const GOLF_TOUR_TYPE = "golf-park";

export const GOLF_PRESET_CATEGORIES = ["골프투어", "파크골프투어"] as const;

export type GolfHeroRegionItem = {
  id: string;
  label: string;
  searchKeyword: string;
};

export function isGolfTourType(tourType: string | null | undefined): boolean {
  return tourType?.trim() === GOLF_TOUR_TYPE;
}

export function buildGolfProductsHref(opts?: { q?: string; region?: string }): string {
  return buildProductsFilterHref({
    tourType: GOLF_TOUR_TYPE,
    q: opts?.q?.trim() || null,
    region: opts?.region?.trim() || null,
  });
}

/** site_settings.golf_hero_regions JSON 파싱 */
export function parseGolfHeroRegions(json: string | null | undefined): GolfHeroRegionItem[] {
  if (!json?.trim()) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const item = row as Record<string, unknown>;
        const id = typeof item.id === "string" ? item.id.trim() : "";
        const label = typeof item.label === "string" ? item.label.trim() : "";
        const searchKeyword =
          typeof item.searchKeyword === "string" ? item.searchKeyword.trim() : label;
        if (!id || !label) return null;
        return { id, label, searchKeyword: searchKeyword || label };
      })
      .filter((item): item is GolfHeroRegionItem => item != null);
  } catch {
    return [];
  }
}
