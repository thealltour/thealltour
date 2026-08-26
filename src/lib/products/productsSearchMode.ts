/**
 * `/products` Search Mode helpers (q 존재 시).
 * 검색 엔진은 `searchProductsByParams` 재사용. Browse Mode와 분리.
 */

import {
  PRODUCT_FILTER_KEYS,
  type ProductFiltersState,
  type ProductSortId,
} from "@/lib/productFilters";
import { normalizePageParam, DEFAULT_PAGE, SEARCH_PAGE_SIZE } from "@/lib/search/searchQueryParams";
import type { SearchFilterState, SearchSortOption } from "@/types/search";

export { SEARCH_PAGE_SIZE, DEFAULT_PAGE };

export const SEARCH_MODE_SORT_OPTIONS: { value: ProductSortId; label: string }[] = [
  { value: "relevance", label: "관련도순" },
  { value: "latest", label: "최신순" },
  { value: "price_asc", label: "가격 낮은순" },
  { value: "price_desc", label: "가격 높은순" },
];

const SEARCH_SORT_SET = new Set<string>(SEARCH_MODE_SORT_OPTIONS.map((o) => o.value));

export function isProductsSearchMode(q: string | null | undefined): boolean {
  return Boolean(typeof q === "string" && q.trim());
}

/** Browse/Search URL sort → searchProductsByParams sort */
export function toSearchEngineSort(sort: ProductSortId | string | null | undefined): SearchSortOption {
  if (sort === "latest" || sort === "price_asc" || sort === "price_desc" || sort === "relevance") {
    return sort;
  }
  return "relevance";
}

/** Search Mode 기본 sort (URL에 sort 없을 때) */
export function resolveSearchModeSort(sort: ProductSortId | string | null | undefined): ProductSortId {
  if (sort && SEARCH_SORT_SET.has(sort)) return sort as ProductSortId;
  return "relevance";
}

/**
 * Products URL filters → /api/search · searchProductsByParams 파라미터.
 * region(name) → destination(name): Search Mode에서 category eq 매칭용.
 */
export function toSearchEngineParams(input: {
  q: string;
  region?: string | null;
  theme?: string | null;
  product_line?: string | null;
  sort?: ProductSortId | string | null;
  page?: number | string | null;
}): {
  q: string;
  destination: string | null;
  theme: string | null;
  product_line: string | null;
  sort: SearchSortOption;
  page: number;
  pageSize: number;
} {
  const page =
    typeof input.page === "number"
      ? Math.max(1, input.page)
      : normalizePageParam(input.page == null ? undefined : String(input.page));

  return {
    q: input.q.trim(),
    destination: input.region?.trim() || null,
    theme: input.theme?.trim() || null,
    product_line: input.product_line?.trim() || null,
    sort: toSearchEngineSort(resolveSearchModeSort(input.sort)),
    page,
    pageSize: SEARCH_PAGE_SIZE,
  };
}

/** Load More / Pagination용 SearchFilterState (API는 destination 키 사용) */
export function toSearchFilterStateForApi(filters: ProductFiltersState, page: number): SearchFilterState {
  return {
    q: filters.q ?? undefined,
    destination: filters.region ?? undefined,
    theme: filters.theme ?? undefined,
    product_line: filters.product_line ?? undefined,
    sort: toSearchEngineSort(resolveSearchModeSort(filters.sort)),
    page,
  };
}

/** Search Mode 페이지 링크 (/products?q=...&page=) */
export function buildProductsSearchModeHref(
  filters: ProductFiltersState,
  page: number,
): string {
  const qs = new URLSearchParams();
  if (filters.q) qs.set(PRODUCT_FILTER_KEYS.Q, filters.q);
  if (filters.region) qs.set(PRODUCT_FILTER_KEYS.REGION, filters.region);
  if (filters.theme) qs.set(PRODUCT_FILTER_KEYS.THEME, filters.theme);
  if (filters.product_line) qs.set(PRODUCT_FILTER_KEYS.PRODUCT_LINE, filters.product_line);
  const sort = resolveSearchModeSort(filters.sort);
  if (sort && sort !== "relevance") qs.set(PRODUCT_FILTER_KEYS.SORT, sort);
  if (page > 1) qs.set("page", String(page));
  const s = qs.toString();
  return s ? `/products?${s}` : "/products";
}

export function parseProductsSearchPage(
  params: Record<string, string | string[] | undefined>,
): number {
  const page = Array.isArray(params.page) ? params.page[0] : params.page;
  return normalizePageParam(page);
}
