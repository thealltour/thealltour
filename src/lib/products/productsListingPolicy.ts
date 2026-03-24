/**
 * `/products` 목록의 **초기 필터 상태**만 결정하는 순수 정책.
 * 서버에서 해석한 `initialFiltersFromServer`는 `productFiltersLanding.resolveLandingParams` 등과 연결되며,
 * 클라이언트에서는 URL과의 우선순위만 이 모듈에서 고정한다.
 */

import {
  parseProductFiltersFromSearchParams,
  PRODUCT_FILTER_KEYS,
  type ProductFiltersState,
} from "@/lib/productFilters";

/** `useSearchParams()` / `URLSearchParams` 등 `get` + `entries`만 쓰는 입력 */
export type ProductsListingSearchParamsLike = {
  get(name: string): string | null;
  entries(): Iterable<readonly [string, string]>;
};

function truthyParam(sp: ProductsListingSearchParamsLike, key: string): boolean {
  const v = sp.get(key);
  return Boolean(v && v.trim());
}

/**
 * 랜딩·메가메뉴 진입용 쿼리 존재 여부.
 * `theme` 키는 필터용 theme과 동일 키이며, **현재 구현 그대로** 이 키만 본다.
 */
export function hasLandingEntryParams(sp: ProductsListingSearchParamsLike): boolean {
  return (
    truthyParam(sp, PRODUCT_FILTER_KEYS.DESTINATION) ||
    truthyParam(sp, PRODUCT_FILTER_KEYS.CITY) ||
    truthyParam(sp, PRODUCT_FILTER_KEYS.THEME)
  );
}

/**
 * 목록 canonical 필터 파라미터 존재 여부.
 * **의도적으로** `collection` / `tourType` 은 포함하지 않는다 (기존 ProductsPageContent 동일).
 */
export function hasCanonicalListingFilterParams(sp: ProductsListingSearchParamsLike): boolean {
  return (
    truthyParam(sp, PRODUCT_FILTER_KEYS.REGION) ||
    truthyParam(sp, PRODUCT_FILTER_KEYS.THEME) ||
    truthyParam(sp, PRODUCT_FILTER_KEYS.PRODUCT_LINE) ||
    truthyParam(sp, PRODUCT_FILTER_KEYS.SORT) ||
    truthyParam(sp, PRODUCT_FILTER_KEYS.Q)
  );
}

/** 서버 초기 필터를 클라이언트 초기값으로 쓸지 (랜딩 진입 또는 쿼리에 canonical 필터 없음). */
export function shouldPreferServerInitialFilters(
  sp: ProductsListingSearchParamsLike,
  initialFiltersFromServer: ProductFiltersState | null,
): boolean {
  if (initialFiltersFromServer == null) return false;
  /** 사이드바 지역·상품군은 URL이 곧 필터 상태 — 서버 스냅샷이 덮어쓰면 안 됨 */
  if (truthyParam(sp, PRODUCT_FILTER_KEYS.REGION)) return false;
  if (truthyParam(sp, PRODUCT_FILTER_KEYS.PRODUCT_LINE)) return false;
  /**
   * `destination`/`city` 없이 `sort`·`q` 만 있는 경우는 목록 조작으로 본다.
   * (`destination`+`q` 랜딩은 서버에서 region/theme/q 를 한 번에 해석해야 함)
   */
  const hasDestOrCity =
    truthyParam(sp, PRODUCT_FILTER_KEYS.DESTINATION) ||
    truthyParam(sp, PRODUCT_FILTER_KEYS.CITY);
  if (!hasDestOrCity && (truthyParam(sp, PRODUCT_FILTER_KEYS.SORT) || truthyParam(sp, PRODUCT_FILTER_KEYS.Q))) {
    return false;
  }
  return hasLandingEntryParams(sp) || !hasCanonicalListingFilterParams(sp);
}

/**
 * `ProductsPageContent` 초기 `filters` — 기존 `useMemo` 분기와 비트 동일.
 */
export function resolveProductsPageInitialFilters(
  searchParams: ProductsListingSearchParamsLike,
  initialFiltersFromServer: ProductFiltersState | null,
): ProductFiltersState {
  if (shouldPreferServerInitialFilters(searchParams, initialFiltersFromServer)) {
    return initialFiltersFromServer!;
  }
  return parseProductFiltersFromSearchParams(Object.fromEntries(searchParams.entries()));
}
