/**
 * 상품 목록 필터: query param 기반 (region, theme, sort).
 * 헤더 링크(/products?region=일본, ?theme=골프)와 동일 키 사용.
 */

import type { Product } from "@/types/product";
import { parseThemeTokens } from "@/lib/productTaxonomies";

export const PRODUCT_FILTER_KEYS = {
  REGION: "region",
  THEME: "theme",
  PRODUCT_LINE: "product_line",
  SORT: "sort",
  Q: "q",
  TOUR_TYPE: "tourType",
  /** 랜딩에서 진입 시 상위 맥락용 (slug) */
  DESTINATION: "destination",
  CITY: "city",
} as const;

export type ProductSortId = "popular" | "latest" | "new" | "";

export type ProductFiltersState = {
  region: string | null;
  theme: string | null;
  product_line: string | null;
  sort: ProductSortId;
  q: string | null;
};

const SORT_VALUES: ProductSortId[] = ["popular", "latest", "new"];

export function parseProductFiltersFromSearchParams(
  params: Record<string, string | string[] | undefined>,
): ProductFiltersState {
  const region = params[PRODUCT_FILTER_KEYS.REGION];
  const theme = params[PRODUCT_FILTER_KEYS.THEME];
  const product_line = params[PRODUCT_FILTER_KEYS.PRODUCT_LINE];
  const sort = params[PRODUCT_FILTER_KEYS.SORT];
  const q = params[PRODUCT_FILTER_KEYS.Q];

  return {
    region: typeof region === "string" && region.trim() ? decodeURIComponent(region.trim()) : null,
    theme: typeof theme === "string" && theme.trim() ? decodeURIComponent(theme.trim()) : null,
    product_line: typeof product_line === "string" && product_line.trim() ? decodeURIComponent(product_line.trim()) : null,
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
  if (state.product_line) p.set(PRODUCT_FILTER_KEYS.PRODUCT_LINE, state.product_line);
  if (state.sort) p.set(PRODUCT_FILTER_KEYS.SORT, state.sort);
  if (state.q) p.set(PRODUCT_FILTER_KEYS.Q, state.q);
  return p.toString();
}

/**
 * 랜딩/하위 카드용 상품 필터 URL 생성.
 * payload에 destination/city/theme(slug) 또는 region/theme/q(name) 사용.
 * 직접 문자열 하드코딩 없이 이 함수 사용.
 */
export function buildProductsFilterHref(payload: {
  destination?: string | null;
  city?: string | null;
  theme?: string | null;
  region?: string | null;
  product_line?: string | null;
  q?: string | null;
  sort?: string | null;
  tourType?: string | null;
}): string {
  const p = new URLSearchParams();
  if (payload.destination?.trim()) p.set(PRODUCT_FILTER_KEYS.DESTINATION, payload.destination.trim());
  if (payload.city?.trim()) p.set(PRODUCT_FILTER_KEYS.CITY, payload.city.trim());
  if (payload.theme?.trim()) p.set(PRODUCT_FILTER_KEYS.THEME, payload.theme.trim());
  if (payload.region?.trim()) p.set(PRODUCT_FILTER_KEYS.REGION, payload.region.trim());
  if (payload.product_line?.trim()) p.set(PRODUCT_FILTER_KEYS.PRODUCT_LINE, payload.product_line.trim());
  if (payload.q?.trim()) p.set(PRODUCT_FILTER_KEYS.Q, payload.q.trim());
  if (payload.sort?.trim()) p.set(PRODUCT_FILTER_KEYS.SORT, payload.sort.trim());
  if (payload.tourType?.trim()) p.set(PRODUCT_FILTER_KEYS.TOUR_TYPE, payload.tourType.trim());
  const qs = p.toString();
  return qs ? `/products?${qs}` : "/products";
}

/** 기존 params에 필터만 반영 (q, tourType 등 유지). 랜딩 slug(destination, city)는 제거해 canonical하게 유지.
 * 즉, 칩 제거·정렬 변경·추가 필터 시 URL은 region/theme/q/sort 만 남고 진입용 destination/city 는 재추가하지 않음.
 */
export function mergeFiltersIntoSearchParams(
  current: URLSearchParams,
  filters: Partial<ProductFiltersState>,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  next.delete(PRODUCT_FILTER_KEYS.DESTINATION);
  next.delete(PRODUCT_FILTER_KEYS.CITY);
  if (filters.region != null) {
    if (filters.region) next.set(PRODUCT_FILTER_KEYS.REGION, filters.region);
    else next.delete(PRODUCT_FILTER_KEYS.REGION);
  }
  if (filters.theme != null) {
    if (filters.theme) next.set(PRODUCT_FILTER_KEYS.THEME, filters.theme);
    else next.delete(PRODUCT_FILTER_KEYS.THEME);
  }
  if (filters.product_line != null) {
    if (filters.product_line) next.set(PRODUCT_FILTER_KEYS.PRODUCT_LINE, filters.product_line);
    else next.delete(PRODUCT_FILTER_KEYS.PRODUCT_LINE);
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

/** region = destination name(category), theme = theme token, product_line = category name(상품군). 정렬 적용. */
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
  if (filters.product_line) {
    const pl = filters.product_line.trim();
    list = list.filter((p) => (p.category ?? "").trim() === pl);
  }
  if (filters.q) {
    const q = filters.q.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    list = list.filter((p) => {
      const haystack = [
        p.title,
        p.description,
        p.category,
        p.theme ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return tokens.some((token) => haystack.includes(token));
    });
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
