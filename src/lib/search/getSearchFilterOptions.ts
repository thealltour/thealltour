import { getHubDestinations } from "@/lib/productTaxonomies";
import { getHubThemes } from "@/lib/productTaxonomies";
import { getActiveProductLineTaxonomies } from "@/lib/productTaxonomies";
import type { SearchFilterOptions } from "@/types/search";

/**
 * product_taxonomies 기반 검색 필터 옵션.
 * destination / theme / product_line 타입별 name 목록 반환.
 */
export async function getSearchFilterOptions(): Promise<SearchFilterOptions> {
  const [destinations, themes, productLines] = await Promise.all([
    getHubDestinations(),
    getHubThemes(),
    getActiveProductLineTaxonomies(),
  ]);

  return {
    destinations: destinations.map((d) => d.name.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "ko")),
    themes: themes.map((t) => t.name.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "ko")),
    productLines: productLines.map((p) => p.name.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "ko")),
  };
}

/** product_line name → id (product_taxonomies). 필터 적용 시 사용. */
export async function getProductLineIdByName(name: string): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const list = await getActiveProductLineTaxonomies();
  const found = list.find((p) => p.name.trim() === trimmed);
  return found?.id ?? null;
}
