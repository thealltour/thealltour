import { buildProductsFilterHref } from "@/lib/productFilters";
import { getSelfAndDescendantIdsAndNames } from "@/lib/productTaxonomies";
import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

/** /products 골프 채널 query param — 헤더·히어로·리드 UTM과 동일 규약 */
export const GOLF_TOUR_TYPE = "golf-park";

export const GOLF_REGION_QUERY_KEY = "golfRegion";

export const GOLF_PRESET_CATEGORIES = ["골프투어", "파크골프투어"] as const;

/** 메가메뉴·골프 히어로 지역 프리셋 — destination taxonomy 대분류 name 기준 */
export const GOLF_REGION_PRESET_IDS = ["japan-china", "se-asia", "overseas"] as const;

export type GolfRegionPresetId = (typeof GOLF_REGION_PRESET_IDS)[number];

/** CMS destination taxonomy 대분류·중분류 name — 「중국 / 대만」 등 병합 노드 포함 */
export const GOLF_REGION_PRESET_DESTINATION_ROOTS: Record<
  GolfRegionPresetId,
  readonly string[]
> = {
  "japan-china": ["일본", "중국", "중국 / 대만", "대만", "홍콩", "마카오"],
  "se-asia": ["동남아"],
  overseas: ["해외"],
};

export const GOLF_REGION_PRESET_LABELS: Record<GolfRegionPresetId, string> = {
  "japan-china": "일본/중국 골프투어",
  "se-asia": "동남아 골프투어",
  overseas: "해외 골프투어",
};

/** site_settings golf_hero_regions id → 프리셋 (레거시 호환) */
const LEGACY_GOLF_HERO_ID_TO_PRESET: Record<string, GolfRegionPresetId> = {
  "golf-japan": "japan-china",
  "golf-japan-china": "japan-china",
  "golf-se-asia": "se-asia",
  "golf-domestic": "overseas",
  "golf-overseas": "overseas",
};

export type GolfHeroRegionItem = {
  id: string;
  label: string;
  /** @deprecated golfRegion 프리셋 우선. 없을 때만 키워드 검색 fallback */
  searchKeyword: string;
  golfRegion?: GolfRegionPresetId;
};

export function isGolfTourType(tourType: string | null | undefined): boolean {
  return tourType?.trim() === GOLF_TOUR_TYPE;
}

export function parseGolfRegionPresetId(
  raw: string | null | undefined,
): GolfRegionPresetId | null {
  const key = raw?.trim() as GolfRegionPresetId | undefined;
  if (!key) return null;
  return (GOLF_REGION_PRESET_IDS as readonly string[]).includes(key) ? key : null;
}

const GOLF_PRODUCT_LINE_PATTERN = /골프|golf|park.?golf|파크골프/i;

/** 골프 상품군(product_line) taxonomy 여부 — 관리자 골프투어 상품 검색 필터용 */
export function isGolfProductLineTaxonomy(item: {
  name?: string | null;
  slug?: string | null;
}): boolean {
  const name = (item.name ?? "").trim();
  const slug = (item.slug ?? "").trim();
  if (GOLF_PRESET_CATEGORIES.some((c) => c === name)) return true;
  return GOLF_PRODUCT_LINE_PATTERN.test(name) || GOLF_PRODUCT_LINE_PATTERN.test(slug);
}

/** 골프 채널(/products?tourType=golf-park) 대상 상품 여부 — product_line_id 우선 */
export function isGolfChannelProduct(
  product: Product,
  taxonomyNameMap: Record<string, string> = {},
): boolean {
  const lineName = product.product_line_id
    ? taxonomyNameMap[product.product_line_id]?.trim() ?? ""
    : "";
  if (lineName) {
    if ((GOLF_PRESET_CATEGORIES as readonly string[]).includes(lineName)) return true;
    if (isGolfProductLineTaxonomy({ name: lineName })) return true;
  }
  const legacyCategory = (product.category ?? "").trim();
  return (GOLF_PRESET_CATEGORIES as readonly string[]).some((c) => c === legacyCategory);
}

export function filterGolfChannelProducts(
  products: Product[],
  taxonomyNameMap: Record<string, string> = {},
): Product[] {
  return products.filter((product) => isGolfChannelProduct(product, taxonomyNameMap));
}

export function collectDestinationIdsAndNamesForRoots(
  nodes: ProductTaxonomy[],
  rootNames: readonly string[],
): { ids: Set<string>; names: Set<string> } {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const rootName of rootNames) {
    const { ids: rowIds, names: rowNames } = getSelfAndDescendantIdsAndNames(nodes, rootName);
    for (const id of rowIds) ids.add(id);
    for (const name of rowNames) names.add(name);
  }
  return { ids, names };
}

export function productMatchesDestinationScope(
  product: Product,
  allowedIds: Set<string>,
  allowedNames: Set<string>,
  taxonomyNameMap: Record<string, string> = {},
): boolean {
  const destId = product.destination_id?.trim();
  if (destId && allowedIds.has(destId)) return true;

  const nameFromFk =
    destId && taxonomyNameMap[destId] ? taxonomyNameMap[destId].trim() : "";
  if (nameFromFk && allowedNames.has(nameFromFk)) return true;

  const legacyCategory = (product.category ?? "").trim();
  if (legacyCategory && allowedNames.has(legacyCategory)) return true;

  return false;
}

/** 골프 채널 + 지역 taxonomy 프리셋(일본·중국 / 동남아 / 해외) 필터 */
export function filterGolfProductsByRegionPreset(
  products: Product[],
  presetId: string | null | undefined,
  destinationTaxonomies: ProductTaxonomy[],
  taxonomyNameMap: Record<string, string> = {},
): Product[] {
  const preset = parseGolfRegionPresetId(presetId);
  if (!preset) return products;

  const roots = GOLF_REGION_PRESET_DESTINATION_ROOTS[preset];
  const { ids, names } = collectDestinationIdsAndNamesForRoots(destinationTaxonomies, roots);
  if (ids.size === 0 && names.size === 0) return products;

  return products.filter((product) =>
    productMatchesDestinationScope(product, ids, names, taxonomyNameMap),
  );
}

export function resolveGolfHeroRegionPreset(region: GolfHeroRegionItem): GolfRegionPresetId | null {
  if (region.golfRegion) return region.golfRegion;
  return LEGACY_GOLF_HERO_ID_TO_PRESET[region.id.trim()] ?? null;
}

export function buildGolfProductsHref(opts?: {
  q?: string;
  region?: string;
  golfRegion?: GolfRegionPresetId | string | null;
}): string {
  return buildProductsFilterHref({
    tourType: GOLF_TOUR_TYPE,
    q: opts?.q?.trim() || null,
    region: opts?.region?.trim() || null,
    golfRegion: opts?.golfRegion?.trim() || null,
  });
}

function resolveGolfRegionFromConfigItem(
  item: Record<string, unknown>,
): GolfRegionPresetId | undefined {
  const explicit = parseGolfRegionPresetId(
    typeof item.golfRegion === "string" ? item.golfRegion : null,
  );
  if (explicit) return explicit;
  const id = typeof item.id === "string" ? item.id.trim() : "";
  return id ? LEGACY_GOLF_HERO_ID_TO_PRESET[id] : undefined;
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
        const golfRegion = resolveGolfRegionFromConfigItem(item);
        if (!id || !label) return null;
        return {
          id,
          label,
          searchKeyword: searchKeyword || label,
          ...(golfRegion ? { golfRegion } : {}),
        };
      })
      .filter((item): item is GolfHeroRegionItem => item != null);
  } catch {
    return [];
  }
}
