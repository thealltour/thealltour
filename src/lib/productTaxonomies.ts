import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import type { Product } from "@/types/product";
import type {
  ProductTaxonomy,
  ProductTaxonomyType,
  ProductTaxonomyWithUsage,
} from "@/types/productTaxonomy";

export function parseThemeTokens(value: string | undefined) {
  if (!value) return [] as string[];
  return value
    .split(/[,\n/|]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function mapTaxonomy(row: Record<string, unknown>): ProductTaxonomy {
  return {
    id: String(row.id ?? ""),
    type: row.type === "theme" ? "theme" : "category",
    name: String(row.name ?? ""),
    is_active: typeof row.is_active === "boolean" ? row.is_active : true,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
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
 * 상품 목록용 카테고리/테마 옵션.
 * productsFallback이 있으면 해당 상품에서 카테고리 추출 (추천 필터 없음).
 * taxonomy 없을 때만 fallback 사용.
 */
export async function getProductTaxonomyOptions(productsFallback: Product[] = []) {
  const taxonomies = await getActiveTaxonomiesCached();

  if (taxonomies === null) {
    return toFallbackTaxonomies(productsFallback);
  }

  // 상품 페이지: 전달된 전체 상품에서 카테고리 추출 (추천 상품만 쓰지 않음)
  if (productsFallback.length > 0) {
    return toFallbackTaxonomies(productsFallback);
  }

  const mapped = taxonomies.map((row) => mapTaxonomy(row));
  const categories = mapped.filter((item) => item.type === "category").map((item) => item.name);
  const themes = mapped.filter((item) => item.type === "theme").map((item) => item.name);
  return { categories, themes };
}

function getUsageCount(products: Product[], type: ProductTaxonomyType, name: string) {
  if (type === "category") {
    return products.filter((product) => product.category === name).length;
  }
  return products.filter((product) => parseThemeTokens(product.theme).includes(name)).length;
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
      type: "category",
      name,
      is_active: true,
      sort_order: null,
      created_at: null,
      usageCount: getUsageCount(products, "category", name),
    }));
    const themeRows: ProductTaxonomyWithUsage[] = fallback.themes.map((name) => ({
      id: `fallback-theme-${name}`,
      type: "theme",
      name,
      is_active: true,
      sort_order: null,
      created_at: null,
      usageCount: getUsageCount(products, "theme", name),
    }));
    return [...categoryRows, ...themeRows];
  }

  return (result.data ?? []).map((row) => {
    const taxonomy = mapTaxonomy(row as Record<string, unknown>);
    return {
      ...taxonomy,
      usageCount: getUsageCount(products, taxonomy.type, taxonomy.name),
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
  { revalidate: 300, tags: ["product-taxonomies"] },
);
