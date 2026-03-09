import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cacheTags";
import type { Product } from "@/types/product";
import type {
  ProductTaxonomy,
  ProductTaxonomyType,
  ProductTaxonomyWithUsage,
  ProductCategoryType,
  TaxonomyType,
} from "@/types/productTaxonomy";
import type { RegionTreeNode } from "@/types/productTaxonomy";

export function parseThemeTokens(value: string | undefined) {
  if (!value) return [] as string[];
  return value
    .split(/[,\n|]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

const TAXONOMY_TYPE_VALUES: TaxonomyType[] = [
  "destination",
  "theme",
  "product_line",
  "campaign",
  "tag",
];

function parseTaxonomyType(val: unknown): TaxonomyType {
  if (typeof val === "string" && TAXONOMY_TYPE_VALUES.includes(val as TaxonomyType)) {
    return val as TaxonomyType;
  }
  return "destination";
}

function mapTaxonomy(row: Record<string, unknown>): ProductTaxonomy {
  const r = row as Record<string, unknown>;
  const optStr = (key: string): string | null =>
    typeof r[key] === "string" ? (r[key] as string) : null;
  const optBool = (key: string, fallback: boolean): boolean =>
    typeof r[key] === "boolean" ? (r[key] as boolean) : fallback;

  const taxonomy_type =
    r.taxonomy_type != null && String(r.taxonomy_type).trim() !== ""
      ? parseTaxonomyType(r.taxonomy_type)
      : r.type === "theme"
        ? "theme"
        : "destination";
  const legacyType: ProductTaxonomyType =
    taxonomy_type === "theme" ? "theme" : "category";
  const category_type: ProductCategoryType | undefined =
    legacyType === "category" && r.category_type != null
      ? (r.category_type as ProductCategoryType)
      : undefined;

  return {
    id: String(row.id ?? ""),
    taxonomy_type,
    type: legacyType,
    name: String(row.name ?? ""),
    slug: typeof row.slug === "string" ? row.slug : null,
    parent_id: r.parent_id != null ? String(r.parent_id) : null,
    is_active: typeof row.is_active === "boolean" ? row.is_active : true,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    category_type,
    is_hub_visible: optBool("is_hub_visible", true),
    is_landing_enabled: optBool("is_landing_enabled", false),
    card_title: optStr("card_title") ?? undefined,
    card_description: optStr("card_description") ?? undefined,
    card_image_url: optStr("card_image_url") ?? undefined,
    landing_title: optStr("landing_title") ?? undefined,
    landing_description: optStr("landing_description") ?? undefined,
    hero_image_url: optStr("hero_image_url") ?? undefined,
    seo_title: optStr("seo_title") ?? undefined,
    seo_description: optStr("seo_description") ?? undefined,
  };
}

function toFallbackTaxonomies(products: Product[]) {
  const categories = Array.from(
    new Set(products.map((product) => product.category?.trim()).filter((value) => Boolean(value))),
  ) as string[];
  const themes = Array.from(
    new Set(products.flatMap((product) => parseThemeTokens(product.theme))),
  );
  return { categories, themes };
}

/**
 * 상품 목록 필터용 taxonomy 옵션 (taxonomy_type 기준).
 * - categories: 지역(destination)만 → 필터 "지역"
 * - themes: 테마(theme)만 → 필터 "테마"
 * - productLines: 상품군(product_line)만 → 필터 "상품군"
 * productsFallback이 있으면 해당 상품에서 카테고리/테마 추출 (추천 필터 없음). taxonomy 없을 때만 fallback 사용.
 */
export async function getProductTaxonomyOptions(productsFallback: Product[] = []): Promise<{
  categories: string[];
  themes: string[];
  productLines: string[];
}> {
  const taxonomies = await getActiveTaxonomiesCached();

  if (taxonomies === null) {
    const fallback = toFallbackTaxonomies(productsFallback);
    return {
      categories: fallback.categories,
      themes: fallback.themes,
      productLines: [],
    };
  }

  if (productsFallback.length > 0) {
    const fallback = toFallbackTaxonomies(productsFallback);
    return {
      categories: fallback.categories,
      themes: fallback.themes,
      productLines: [],
    };
  }

  const mapped = taxonomies.map((row) => mapTaxonomy(row));
  const categories = mapped
    .filter((item) => item.taxonomy_type === "destination")
    .map((item) => item.name);
  const themes = mapped
    .filter((item) => item.taxonomy_type === "theme")
    .map((item) => item.name);
  const productLines = mapped
    .filter((item) => item.taxonomy_type === "product_line")
    .map((item) => item.name);
  return { categories, themes, productLines };
}

function getUsageCount(
  products: Product[],
  taxonomyType: TaxonomyType,
  name: string,
): number {
  if (
    taxonomyType === "destination" ||
    taxonomyType === "product_line" ||
    taxonomyType === "campaign"
  ) {
    return products.filter((product) => product.category === name).length;
  }
  if (taxonomyType === "theme") {
    return products.filter((product) =>
      parseThemeTokens(product.theme).includes(name),
    ).length;
  }
  return 0;
}

export async function getProductTaxonomiesWithUsage(products: Product[]) {
  const result = await supabase
    .from("product_taxonomies")
    .select("*")
    .order("type", { ascending: true })
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (result.error) {
    const fallback = toFallbackTaxonomies(products);
    const categoryRows: ProductTaxonomyWithUsage[] = fallback.categories.map((name) => ({
      id: `fallback-category-${name}`,
      taxonomy_type: "destination",
      name,
      slug: null,
      is_active: true,
      sort_order: null,
      created_at: null,
      is_hub_visible: true,
      is_landing_enabled: false,
      usageCount: getUsageCount(products, "destination", name),
    }));
    const themeRows: ProductTaxonomyWithUsage[] = fallback.themes.map((name) => ({
      id: `fallback-theme-${name}`,
      taxonomy_type: "theme",
      name,
      slug: null,
      is_active: true,
      sort_order: null,
      created_at: null,
      is_hub_visible: true,
      is_landing_enabled: false,
      usageCount: getUsageCount(products, "theme", name),
    }));
    return [...categoryRows, ...themeRows];
  }

  return (result.data ?? []).map((row) => {
    const taxonomy = mapTaxonomy(row as Record<string, unknown>);
    return {
      ...taxonomy,
      usageCount: getUsageCount(products, taxonomy.taxonomy_type, taxonomy.name),
    };
  });
}

const getActiveTaxonomiesCached = unstable_cache(
  async () => {
    const result = await supabase
      .from("product_taxonomies")
      .select("*")
      .eq("is_active", true)
      .order("type", { ascending: true })
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (result.error) return null;
    return (result.data ?? []) as Record<string, unknown>[];
  },
  ["product-taxonomies:active"],
  { revalidate: 300, tags: [CACHE_TAGS.TAXONOMY, CACHE_TAGS.HEADER_NAV] },
);

/**
 * 헤더/필터용 활성 taxonomy 목록 (캐시 공유).
 * taxonomy / header-nav revalidate 시 갱신됨.
 */
export async function getActiveTaxonomiesForHeader(): Promise<ProductTaxonomy[]> {
  const rows = await getActiveTaxonomiesCached();
  if (!rows) return [];
  return rows.map((r) => mapTaxonomy(r));
}

/** 허브 페이지용: 활성 + 허브 노출인 destination(지역) 목록.
 * taxonomy_type='destination' 기준. is_landing_enabled 는 허브 조회에 사용하지 않음.
 */
const getHubDestinationsCached = unstable_cache(
  async (): Promise<ProductTaxonomy[]> => {
    const result = await supabase
      .from("product_taxonomies")
      .select("*")
      .eq("taxonomy_type", "destination")
      .eq("is_active", true)
      .eq("is_hub_visible", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (result.error) return [];
    return (result.data ?? []).map((r) => mapTaxonomy(r as Record<string, unknown>));
  },
  ["product-taxonomies:hub-destinations"],
  { revalidate: 300, tags: [CACHE_TAGS.TAXONOMY, CACHE_TAGS.HEADER_NAV] },
);

/** 허브 페이지용: 활성 + 허브 노출인 theme(테마) 목록. taxonomy_type='theme' 기준. */
const getHubThemesCached = unstable_cache(
  async (): Promise<ProductTaxonomy[]> => {
    const result = await supabase
      .from("product_taxonomies")
      .select("*")
      .eq("taxonomy_type", "theme")
      .eq("is_active", true)
      .eq("is_hub_visible", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (result.error) return [];
    return (result.data ?? []).map((r) => mapTaxonomy(r as Record<string, unknown>));
  },
  ["product-taxonomies:hub-themes"],
  { revalidate: 300, tags: [CACHE_TAGS.TAXONOMY, CACHE_TAGS.HEADER_NAV] },
);

export async function getHubDestinations(): Promise<ProductTaxonomy[]> {
  return getHubDestinationsCached();
}

/** 허브 destination 목록을 대분류 > 중분류 > 소분류 트리로 변환. 상품 필터 좌측용. */
export function buildRegionTree(destinations: ProductTaxonomy[]): RegionTreeNode[] {
  const sortByOrderThenName = (a: ProductTaxonomy, b: ProductTaxonomy) => {
    const sa = a.sort_order ?? 9999;
    const sb = b.sort_order ?? 9999;
    if (sa !== sb) return sa - sb;
    return (a.name ?? "").localeCompare(b.name ?? "", "ko");
  };
  const byParent = new Map<string, ProductTaxonomy[]>();
  for (const d of destinations) {
    const pid = (d.parent_id ?? "").trim() || "_root";
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(d);
  }
  for (const arr of byParent.values()) arr.sort(sortByOrderThenName);

  function toNode(d: ProductTaxonomy): RegionTreeNode {
    const children = byParent.get(d.id);
    const sorted = children ? [...children].sort(sortByOrderThenName) : [];
    return {
      id: d.id,
      name: d.name ?? "",
      children: sorted.length > 0 ? sorted.map(toNode) : undefined,
    };
  }

  const roots = byParent.get("_root") ?? [];
  roots.sort(sortByOrderThenName);
  return roots.map(toNode);
}

/** 허브 theme 목록을 부모>자식 트리로 변환. 상품 필터 좌측 테마 접이식용. */
export function buildThemeTree(themes: ProductTaxonomy[]): RegionTreeNode[] {
  return buildRegionTree(themes);
}

export async function getHubThemes(): Promise<ProductTaxonomy[]> {
  return getHubThemesCached();
}

/**
 * slug로 destination 1건 조회. taxonomy_type='destination' 기준.
 * 상세 랜딩 공개 여부는 반환 후 is_landing_enabled로 확인.
 */
export async function getDestinationBySlug(slug: string): Promise<ProductTaxonomy | null> {
  const normalized = slug.trim().toLowerCase().replace(/\s+/g, "-");
  if (!normalized) return null;
  const result = await supabase
    .from("product_taxonomies")
    .select("*")
    .eq("taxonomy_type", "destination")
    .eq("is_active", true)
    .eq("slug", normalized)
    .maybeSingle();
  if (result.error || !result.data) return null;
  return mapTaxonomy(result.data as Record<string, unknown>);
}

/**
 * 상세 랜딩 공개된 destination만 slug로 조회.
 * is_landing_enabled === true 인 경우만 반환. [slug] 페이지에서 사용.
 */
export async function getDestinationBySlugForPublicLanding(
  slug: string,
): Promise<ProductTaxonomy | null> {
  const item = await getDestinationBySlug(slug);
  if (!item || !item.is_landing_enabled) return null;
  return item;
}

/**
 * slug로 theme 1건 조회. taxonomy_type='theme' 기준.
 * 상세 랜딩 공개 여부는 반환 후 is_landing_enabled로 확인.
 */
export async function getThemeBySlug(slug: string): Promise<ProductTaxonomy | null> {
  const normalized = slug.trim().toLowerCase().replace(/\s+/g, "-");
  if (!normalized) return null;
  const result = await supabase
    .from("product_taxonomies")
    .select("*")
    .eq("taxonomy_type", "theme")
    .eq("is_active", true)
    .eq("slug", normalized)
    .maybeSingle();
  if (result.error || !result.data) return null;
  return mapTaxonomy(result.data as Record<string, unknown>);
}

/**
 * 상세 랜딩 공개된 theme만 slug로 조회.
 * is_landing_enabled === true 인 경우만 반환. [slug] 페이지에서 사용.
 */
export async function getThemeBySlugForPublicLanding(
  slug: string,
): Promise<ProductTaxonomy | null> {
  const item = await getThemeBySlug(slug);
  if (!item || !item.is_landing_enabled) return null;
  return item;
}

/** slug → name 폴백 (taxonomy에 slug 미설정 시 랜딩용) */
const SLUG_TO_REGION_NAME: Record<string, string> = {
  japan: "일본",
  "south-america": "남미",
  "south-america-americas": "미국·남미",
  sea: "동남아",
  asia: "동남아",
  indonesia: "인도네시아",
  europe: "유럽",
  americas: "미국·남미",
};
const SLUG_TO_THEME_NAME: Record<string, string> = {
  golf: "골프",
  "park-golf": "파크골프",
  premium: "프리미엄",
  group: "단체/동호회",
  honeymoon: "허니문",
};

/**
 * region/theme 랜딩용: slug로 taxonomy name 조회.
 * type 'category' -> taxonomy_type='destination', type 'theme' -> taxonomy_type='theme'.
 */
export async function getTaxonomyNameBySlug(
  type: "category" | "theme",
  slug: string,
): Promise<string | null> {
  const normalizedSlug = slug.trim().toLowerCase().replace(/\s+/g, "-");
  if (!normalizedSlug) return null;

  const taxonomyType: TaxonomyType = type === "theme" ? "theme" : "destination";
  const rows = await getActiveTaxonomiesCached();
  if (rows) {
    const match = rows.find(
      (r) => {
        const row = r as Record<string, unknown>;
        const effectiveType: TaxonomyType =
          row.taxonomy_type != null && String(row.taxonomy_type).trim() !== ""
            ? parseTaxonomyType(row.taxonomy_type)
            : row.type === "theme"
              ? "theme"
              : "destination";
        const slugVal = typeof row.slug === "string" ? row.slug.trim().toLowerCase().replace(/\s+/g, "-") : "";
        return effectiveType === taxonomyType && slugVal === normalizedSlug;
      },
    );
    if (match) return String((match as Record<string, unknown>).name ?? "");
  }

  const fallback = type === "category" ? SLUG_TO_REGION_NAME : SLUG_TO_THEME_NAME;
  return fallback[normalizedSlug] ?? null;
}
