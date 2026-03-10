import { supabase } from "@/lib/supabase";
import { normalizeProduct } from "@/lib/products";
import { parseThemeTokens } from "@/lib/productTaxonomies";
import { getProductLineIdByName } from "@/lib/search/getSearchFilterOptions";
import { DEFAULT_PAGE, SEARCH_PAGE_SIZE } from "@/lib/search/searchQueryParams";
import type { Product } from "@/types/product";
import type { SearchProductsParams, SearchProductsResult, SearchSortOption } from "@/types/search";
import type { SearchFilterOptions } from "@/types/search";

const DEFAULT_SORT: SearchSortOption = "relevance";
const MAX_LIMIT = 100;
const RELEVANCE_FETCH_LIMIT = 200;

/** ilike 패턴 내 % _ \ 이스케이프 (Postgres) */
function escapeForIlike(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * 검색어 relevance 점수: 낮을수록 우선.
 * 1 title 정확 일치, 2 title prefix, 3 title 포함, 4 category/theme 포함, 5 그 외
 */
function relevanceScore(product: Product, keyword: string): number {
  const k = keyword.toLowerCase();
  const t = (product.title ?? "").toLowerCase();
  const c = (product.category ?? "").toLowerCase();
  const th = (product.theme ?? "").toLowerCase();
  if (t === k) return 1;
  if (t.startsWith(k)) return 2;
  if (t.includes(k)) return 3;
  if (c.includes(k) || th.includes(k)) return 4;
  return 5;
}

/**
 * 검색 대상: product title, category(지역명 등), theme.
 * @deprecated 검색 필터/정렬이 필요하면 searchProductsByParams 사용.
 */
export async function searchProducts(keyword: string): Promise<Product[]> {
  const result = await searchProductsByParams({ q: keyword.trim() || undefined, page: 1, pageSize: MAX_LIMIT });
  return result.items;
}

export type { SearchProductsParams, SearchProductsResult };

/**
 * params 기반 검색.
 * - q: title/category/theme ilike (relevance 정렬 시 클라이언트에서 우선순위 적용)
 * - destination: category 정확 일치 (.eq)
 * - theme: theme ilike '%value%'
 * - product_line: product_line_id 로 정확 필터 (taxonomy name → id 해석)
 * - sort: relevance | latest | price_asc | price_desc (price는 nulls last)
 * - page / pageSize: 페이지네이션. 미지정 시 page=1, pageSize=SEARCH_PAGE_SIZE
 */
export async function searchProductsByParams(
  params: SearchProductsParams & { page?: number; pageSize?: number },
): Promise<SearchProductsResult> {
  const q = params.q?.trim();
  const destination = params.destination?.trim();
  const theme = params.theme?.trim();
  const productLineParam = params.product_line?.trim();
  const sort = params.sort ?? DEFAULT_SORT;
  const page = params.page ?? DEFAULT_PAGE;
  const pageSize = params.pageSize ?? SEARCH_PAGE_SIZE;

  const hasCondition = q || destination || theme || productLineParam;
  if (!hasCondition) {
    return { items: [], totalCount: 0, page: 1, pageSize, totalPages: 0 };
  }

  const productLineId = productLineParam ? await getProductLineIdByName(productLineParam) : null;

  function baseQuery() {
    let qb = supabase
      .from("products")
      .select("*")
      .eq("is_active", true);
    if (q) {
      const escaped = escapeForIlike(q);
      const pattern = `%${escaped}%`;
      qb = qb.or(`title.ilike.${pattern},category.ilike.${pattern},theme.ilike.${pattern}`);
    }
    if (destination) qb = qb.eq("category", destination);
    if (theme) {
      const escaped = escapeForIlike(theme);
      qb = qb.ilike("theme", `%${escaped}%`);
    }
    if (productLineId) qb = qb.eq("product_line_id", productLineId);
    return qb;
  }

  /** count만 필요할 때 사용. baseQuery().select() 중복 호출 방지용. */
  function countQuery() {
    let qb = supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);
    if (q) {
      const escaped = escapeForIlike(q);
      const pattern = `%${escaped}%`;
      qb = qb.or(`title.ilike.${pattern},category.ilike.${pattern},theme.ilike.${pattern}`);
    }
    if (destination) qb = qb.eq("category", destination);
    if (theme) {
      const escaped = escapeForIlike(theme);
      qb = qb.ilike("theme", `%${escaped}%`);
    }
    if (productLineId) qb = qb.eq("product_line_id", productLineId);
    return qb;
  }

  const useRelevanceSort = sort === "relevance" && q;

  if (useRelevanceSort && q) {
    const { count: totalCount, error: countError } = await countQuery();
    if (countError) {
      console.error("[search] count error:", countError.message);
      return { items: [], totalCount: 0, page: 1, pageSize, totalPages: 0 };
    }
    const total = typeof totalCount === "number" ? totalCount : 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const fetchLimit = Math.min(RELEVANCE_FETCH_LIMIT, total);
    if (fetchLimit === 0) {
      return { items: [], totalCount: 0, page: 1, pageSize, totalPages: 0 };
    }
    let dataQuery = baseQuery()
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(fetchLimit);
    const { data, error } = await dataQuery;
    if (error) {
      console.error("[search] searchProductsByParams error:", error.message);
      return { items: [], totalCount: total, page: safePage, pageSize, totalPages };
    }
    let products = (data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>));
    products = products
      .sort((a, b) => {
        const sa = relevanceScore(a, q);
        const sb = relevanceScore(b, q);
        if (sa !== sb) return sa - sb;
        const orderA = a.sort_order ?? 9999;
        const orderB = b.sort_order ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      })
      .slice(0, MAX_LIMIT);
    const seen = new Set<string>();
    products = products.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    const totalRelevance = products.length;
    const totalPagesRelevance = Math.max(1, Math.ceil(totalRelevance / pageSize));
    const safePageRelevance = Math.min(Math.max(1, page), totalPagesRelevance);
    const from = (safePageRelevance - 1) * pageSize;
    const items = products.slice(from, from + pageSize);
    return { items, totalCount: totalRelevance, page: safePageRelevance, pageSize, totalPages: totalPagesRelevance };
  }

  const { count: totalCount, error: countError } = await countQuery();
  if (countError) {
    console.error("[search] count error:", countError.message);
    return { items: [], totalCount: 0, page: 1, pageSize, totalPages: 0 };
  }
  const total = typeof totalCount === "number" ? totalCount : 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;

  let dataQuery = baseQuery();
  switch (sort) {
    case "latest":
      dataQuery = dataQuery
        .order("created_at", { ascending: false, nullsFirst: false })
        .order("sort_order", { ascending: true, nullsFirst: false });
      break;
    case "price_asc":
      dataQuery = dataQuery
        .order("price", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false });
      break;
    case "price_desc":
      dataQuery = dataQuery
        .order("price", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false });
      break;
    default:
      dataQuery = dataQuery
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false });
  }
  const { data, error } = await dataQuery.range(from, to);
  if (error) {
    console.error("[search] searchProductsByParams error:", error.message);
    return { items: [], totalCount: total, page: safePage, pageSize, totalPages };
  }
  let products = (data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>));
  const seen = new Set<string>();
  products = products.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  return { items: products, totalCount: total, page: safePage, pageSize, totalPages };
}

/**
 * 검색 결과 Product[]에서 필터 옵션 파생 (fallback).
 * @deprecated getSearchFilterOptions (taxonomies 기반) 사용 권장.
 */
export function deriveSearchFilterOptions(products: Product[]): SearchFilterOptions {
  const destinations = Array.from(
    new Set(products.map((p) => p.category?.trim()).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b, "ko"));
  const themeSet = new Set<string>();
  for (const p of products) {
    for (const t of parseThemeTokens(p.theme)) {
      if (t) themeSet.add(t);
    }
  }
  const themes = Array.from(themeSet).sort((a, b) => a.localeCompare(b, "ko"));
  return {
    destinations,
    themes,
    productLines: [],
  };
}
