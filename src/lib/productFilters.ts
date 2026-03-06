/**
 * 상품 목록 필터: query param 기반 (region, theme, sort).
 * 헤더 링크(/products?region=일본, ?theme=골프)와 동일 키 사용.
 */

import type { Product } from "@/types/product";
import { parseThemeTokens } from "@/lib/productTaxonomies";

export const PRODUCT_FILTER_KEYS = {
  REGION: "region",
  THEME: "theme",
  SORT: "sort",
  Q: "q",
  TOUR_TYPE: "tourType",
} as const;

export type ProductSortId = "popular" | "latest" | "new" | "";

export type ProductFiltersState = {
  region: string | null;
  theme: string | null;
  sort: ProductSortId;
  q: string | null;
};

const SORT_VALUES: ProductSortId[] = ["popular", "latest", "new"];

export function parseProductFiltersFromSearchParams(
  params: Record<string, string | string[] | undefined>,
): ProductFiltersState {
  const region = params[PRODUCT_FILTER_KEYS.REGION];
  const theme = params[PRODUCT_FILTER_KEYS.THEME];
  const sort = params[PRODUCT_FILTER_KEYS.SORT];
  const q = params[PRODUCT_FILTER_KEYS.Q];

  return {
    region: typeof region === "string" && region.trim() ? decodeURIComponent(region.trim()) : null,
    theme: typeof theme === "string" && theme.trim() ? decodeURIComponent(theme.trim()) : null,
    sort:
      typeof sort === "string" && SORT_VALUES.includes(sort as ProductSortId)
        ? (sort as ProductSortId)
        : "",
    q: typeof q === "string" && q.trim() ? q.trim() : null,
  };
}

export function buildProductsSearchParams(state: Partial<ProductFiltersState>): string {
  const p = new URLSearchParams();
  if (state.region) p.set(PRODUCT_FILTER_KEYS.REGION, state.region);
  if (state.theme) p.set(PRODUCT_FILTER_KEYS.THEME, state.theme);
  if (state.sort) p.set(PRODUCT_FILTER_KEYS.SORT, state.sort);
  if (state.q) p.set(PRODUCT_FILTER_KEYS.Q, state.q);
  return p.toString();
}

/** 기존 params에 필터만 반영 (q, tourType 등 유지) */
export function mergeFiltersIntoSearchParams(
  current: URLSearchParams,
  filters: Partial<ProductFiltersState>,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  if (filters.region != null) {
    if (filters.region) next.set(PRODUCT_FILTER_KEYS.REGION, filters.region);
    else next.delete(PRODUCT_FILTER_KEYS.REGION);
  }
  if (filters.theme != null) {
    if (filters.theme) next.set(PRODUCT_FILTER_KEYS.THEME, filters.theme);
    else next.delete(PRODUCT_FILTER_KEYS.THEME);
  }
  if (filters.sort != null) {
    if (filters.sort) next.set(PRODUCT_FILTER_KEYS.SORT, filters.sort);
    else next.delete(PRODUCT_FILTER_KEYS.SORT);
  }
  if (filters.q != null) {
    if (filters.q) next.set(PRODUCT_FILTER_KEYS.Q, filters.q);
    else next.delete(PRODUCT_FILTER_KEYS.Q);
  }
  return next;
}

export const SORT_OPTIONS: { value: ProductSortId; label: string }[] = [
  { value: "latest", label: "최신순" },
  { value: "new", label: "신규순" },
  { value: "popular", label: "인기순" },
];

/** region = category name, theme = theme token. 정렬 적용. */
export function applyProductFilters(
  products: Product[],
  filters: ProductFiltersState,
): Product[] {
  let list = products;

  if (filters.region) {
    const r = filters.region.trim();
    list = list.filter((p) => (p.category ?? "").trim() === r);
  }
  if (filters.theme) {
    const t = filters.theme.trim();
    list = list.filter((p) => parseThemeTokens(p.theme).includes(t));
  }

  if (filters.sort === "latest" || filters.sort === "new") {
    list = [...list].sort((a, b) => {
      const aAt = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bAt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bAt - aAt;
    });
  } else if (filters.sort === "popular") {
    list = [...list].sort((a, b) => {
      const aOrder = typeof a.sort_order === "number" ? a.sort_order : 9999;
      const bOrder = typeof b.sort_order === "number" ? b.sort_order : 9999;
      return aOrder - bOrder;
    });
  }

  return list;
}
