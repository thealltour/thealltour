/**
 * Browse Mode `/products` numbered pagination href helpers.
 * Preserves region/theme/product_line/sort/collection/tourType/golfRegion.
 */

import { PRODUCT_FILTER_KEYS } from "@/lib/productFilters";

export type BrowseListingUrlState = {
  region?: string | null;
  theme?: string | null;
  product_line?: string | null;
  sort?: string | null;
  collection?: string | null;
  tourType?: string | null;
  golfRegion?: string | null;
};

function setIfPresent(qs: URLSearchParams, key: string, value: string | null | undefined) {
  const t = typeof value === "string" ? value.trim() : "";
  if (t) qs.set(key, t);
}

/**
 * Build `/products?...&page=N` for Browse pagination.
 * page=1 omits `page` for cleaner URLs (same as Search Mode).
 */
export function buildProductsBrowsePageHref(
  filters: BrowseListingUrlState,
  page: number,
  basePath = "/products",
): string {
  const qs = new URLSearchParams();
  setIfPresent(qs, PRODUCT_FILTER_KEYS.REGION, filters.region);
  setIfPresent(qs, PRODUCT_FILTER_KEYS.THEME, filters.theme);
  setIfPresent(qs, PRODUCT_FILTER_KEYS.PRODUCT_LINE, filters.product_line);
  setIfPresent(qs, PRODUCT_FILTER_KEYS.SORT, filters.sort);
  setIfPresent(qs, PRODUCT_FILTER_KEYS.COLLECTION, filters.collection);
  setIfPresent(qs, PRODUCT_FILTER_KEYS.TOUR_TYPE, filters.tourType);
  setIfPresent(qs, PRODUCT_FILTER_KEYS.GOLF_REGION, filters.golfRegion);
  const p = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  if (p > 1) qs.set("page", String(p));
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

/** Read tourType/golfRegion from URLSearchParams (not in ProductFiltersState). */
export function readBrowseChannelParams(searchParams: {
  get(name: string): string | null;
}): Pick<BrowseListingUrlState, "tourType" | "golfRegion"> {
  return {
    tourType: searchParams.get(PRODUCT_FILTER_KEYS.TOUR_TYPE),
    golfRegion: searchParams.get(PRODUCT_FILTER_KEYS.GOLF_REGION),
  };
}
