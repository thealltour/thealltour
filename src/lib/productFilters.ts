/**
 * 상품 목록 필터: query param 기반 (region, theme, sort).
 * 헤더 링크(/products?region=일본, ?theme=골프)와 동일 키 사용.
 */

import type { Product } from "@/types/product";
import { parseThemeTokens } from "@/lib/productTaxonomies";
import {
  buildProductsKeywordHaystack,
  tokenizeListingQueryKeyword,
} from "@/lib/products/productsSearchPolicy";

export const PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE = "패키지여행";

export const PRODUCT_FILTER_KEYS = {
  REGION: "region",
  THEME: "theme",
  PRODUCT_LINE: "product_line",
  SORT: "sort",
  Q: "q",
  /** 여행추천 메가메뉴용: recommend | popular | new */
  COLLECTION: "collection",
  TOUR_TYPE: "tourType",
  /** 골프 채널 지역 프리셋: japan-china | se-asia | overseas */
  GOLF_REGION: "golfRegion",
  /** 랜딩에서 진입 시 상위 맥락용 (slug) */
  DESTINATION: "destination",
  CITY: "city",
} as const;

export type ProductSortId =
  | "recommended"
  | "price_asc"
  | "price_desc"
  | "popular"
  | "latest"
  | "new"
  | "";

export type ProductFiltersState = {
  region: string | null;
  theme: string | null;
  product_line: string | null;
  sort: ProductSortId;
  q: string | null;
  collection: string | null;
};

export type ProductCollectionId = "recommend" | "popular" | "new";

export const PRODUCT_COLLECTION_LABELS: Record<ProductCollectionId, string> = {
  recommend: "추천상품",
  popular: "인기상품",
  new: "신규상품",
};

export const PRODUCT_COLLECTION_SWITCH_OPTIONS: ReadonlyArray<{
  value: ProductCollectionId | null;
  label: string;
}> = [
  { value: null, label: "전체" },
  { value: "recommend", label: PRODUCT_COLLECTION_LABELS.recommend },
  { value: "popular", label: PRODUCT_COLLECTION_LABELS.popular },
  { value: "new", label: PRODUCT_COLLECTION_LABELS.new },
];

export function getCollectionLabel(collection: string | null): string | null {
  if (!collection) return null;
  const key = collection.trim() as ProductCollectionId;
  return PRODUCT_COLLECTION_LABELS[key] ?? collection.trim();
}

export const SORT_OPTIONS: { value: ProductSortId; label: string }[] = [
  { value: "recommended", label: "추천순" },
  { value: "price_asc", label: "가격 낮은순" },
  { value: "price_desc", label: "가격 높은순" },
  { value: "latest", label: "최신순" },
  { value: "new", label: "신규순" },
  { value: "popular", label: "인기순" },
];

const SORT_VALUES: ProductSortId[] = SORT_OPTIONS.map((o) => o.value);

export function parseProductFiltersFromSearchParams(
  params: Record<string, string | string[] | undefined>,
): ProductFiltersState {
  const region = params[PRODUCT_FILTER_KEYS.REGION];
  const theme = params[PRODUCT_FILTER_KEYS.THEME];
  const product_line = params[PRODUCT_FILTER_KEYS.PRODUCT_LINE];
  const sort = params[PRODUCT_FILTER_KEYS.SORT];
  const q = params[PRODUCT_FILTER_KEYS.Q];
  const collection = params[PRODUCT_FILTER_KEYS.COLLECTION];

  return {
    region: typeof region === "string" && region.trim() ? decodeURIComponent(region.trim()) : null,
    theme: typeof theme === "string" && theme.trim() ? decodeURIComponent(theme.trim()) : null,
    product_line: typeof product_line === "string" && product_line.trim() ? decodeURIComponent(product_line.trim()) : null,
    sort:
      typeof sort === "string" && SORT_VALUES.includes(sort as ProductSortId)
        ? (sort as ProductSortId)
        : "",
    q: typeof q === "string" && q.trim() ? q.trim() : null,
    collection:
      typeof collection === "string" && collection.trim()
        ? decodeURIComponent(collection.trim())
        : null,
  };
}

export function buildProductsSearchParams(state: Partial<ProductFiltersState>): string {
  const p = new URLSearchParams();
  if (state.region) p.set(PRODUCT_FILTER_KEYS.REGION, state.region);
  if (state.theme) p.set(PRODUCT_FILTER_KEYS.THEME, state.theme);
  if (state.product_line) p.set(PRODUCT_FILTER_KEYS.PRODUCT_LINE, state.product_line);
  if (state.sort) p.set(PRODUCT_FILTER_KEYS.SORT, state.sort);
  if (state.q) p.set(PRODUCT_FILTER_KEYS.Q, state.q);
  if (state.collection) p.set(PRODUCT_FILTER_KEYS.COLLECTION, state.collection);
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
  collection?: string | null;
  tourType?: string | null;
  golfRegion?: string | null;
}): string {
  const p = new URLSearchParams();
  if (payload.destination?.trim()) p.set(PRODUCT_FILTER_KEYS.DESTINATION, payload.destination.trim());
  if (payload.city?.trim()) p.set(PRODUCT_FILTER_KEYS.CITY, payload.city.trim());
  if (payload.theme?.trim()) p.set(PRODUCT_FILTER_KEYS.THEME, payload.theme.trim());
  if (payload.region?.trim()) p.set(PRODUCT_FILTER_KEYS.REGION, payload.region.trim());
  if (payload.product_line?.trim()) p.set(PRODUCT_FILTER_KEYS.PRODUCT_LINE, payload.product_line.trim());
  if (payload.q?.trim()) p.set(PRODUCT_FILTER_KEYS.Q, payload.q.trim());
  if (payload.sort?.trim()) p.set(PRODUCT_FILTER_KEYS.SORT, payload.sort.trim());
  if (payload.collection?.trim()) p.set(PRODUCT_FILTER_KEYS.COLLECTION, payload.collection.trim());
  if (payload.tourType?.trim()) p.set(PRODUCT_FILTER_KEYS.TOUR_TYPE, payload.tourType.trim());
  if (payload.golfRegion?.trim()) p.set(PRODUCT_FILTER_KEYS.GOLF_REGION, payload.golfRegion.trim());
  const qs = p.toString();
  return qs ? `/products?${qs}` : "/products";
}

/** 기존 params에 필터만 반영 (q, tourType 등 유지). 랜딩 slug(destination, city)는 제거해 canonical하게 유지.
 * 즉, 칩 제거·정렬 변경·추가 필터 시 URL은 region/theme/q/sort 만 남고 진입용 destination/city 는 재추가하지 않음.
 */
/**
 * `filters`는 보통 `ProductsPageContent`에서 `{ ...현재상태, ...변경분 }` 전체 `ProductFiltersState`로 넘긴다.
 * `region`/`theme` 등이 `null`일 때도 URL에서 해당 키를 **반드시 제거**해야 칩·사이드바와 쿼리가 일치한다.
 */
export function mergeFiltersIntoSearchParams(
  current: URLSearchParams,
  filters: ProductFiltersState,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  next.delete(PRODUCT_FILTER_KEYS.DESTINATION);
  next.delete(PRODUCT_FILTER_KEYS.CITY);
  if (filters.region) next.set(PRODUCT_FILTER_KEYS.REGION, filters.region);
  else next.delete(PRODUCT_FILTER_KEYS.REGION);
  if (filters.theme) next.set(PRODUCT_FILTER_KEYS.THEME, filters.theme);
  else next.delete(PRODUCT_FILTER_KEYS.THEME);
  if (filters.product_line) next.set(PRODUCT_FILTER_KEYS.PRODUCT_LINE, filters.product_line);
  else next.delete(PRODUCT_FILTER_KEYS.PRODUCT_LINE);
  if (filters.sort) next.set(PRODUCT_FILTER_KEYS.SORT, filters.sort);
  else next.delete(PRODUCT_FILTER_KEYS.SORT);
  if (filters.q) next.set(PRODUCT_FILTER_KEYS.Q, filters.q);
  else next.delete(PRODUCT_FILTER_KEYS.Q);
  if (filters.collection) next.set(PRODUCT_FILTER_KEYS.COLLECTION, filters.collection);
  else next.delete(PRODUCT_FILTER_KEYS.COLLECTION);
  return next;
}

/** 랜딩 페이지에서 상위 지역/테마 선택 시 하위 전체 포함하려면 전달. */
export type ProductFiltersApplyOptions = {
  regionDescendants?: { ids: string[]; names: string[] };
  regionDescendantForName?: string;
  themeDescendantNames?: string[];
  themeDescendantForName?: string;
  /**
   * `collection=recommend|popular` 시 상품 `campaigns`와 매칭할 기획 taxonomy **이름**.
   * `site_settings`의 campaign id를 서버에서 풀어 전달.
   */
  collectionCampaignNames?: { recommend: string[]; popular: string[] };
};

function productMatchesCampaignNameSet(product: Product, nameSet: Set<string>): boolean {
  if (nameSet.size === 0) return false;
  const camps = product.campaigns ?? product.campaigns_json ?? [];
  if (!Array.isArray(camps)) return false;
  return camps.some((c) => typeof c === "string" && nameSet.has(c.trim()));
}

/** region = destination name(category), theme = theme token, product_line = category name(상품군). 정렬 적용.
 * taxonomyNameMap 있으면 destination_id / product_line_id FK 기반 우선, 없거나 매칭 실패 시 category/theme 문자열 fallback.
 * options에 regionDescendants/themeDescendantNames 전달 시 해당 이름일 때 하위 전체 포함. */
export function applyProductFilters(
  products: Product[],
  filters: ProductFiltersState,
  taxonomyNameMap?: Record<string, string>,
  options?: ProductFiltersApplyOptions,
): Product[] {
  let list = products;
  const map = taxonomyNameMap ?? {};

  if (filters.region) {
    const r = filters.region.trim();
    const useDescendants =
      options?.regionDescendants &&
      options?.regionDescendantForName &&
      options.regionDescendantForName.trim() === r;
    if (useDescendants && options!.regionDescendants!) {
      const idsSet = new Set(options.regionDescendants.ids);
      const namesSet = new Set(options.regionDescendants.names);
      list = list.filter((p) => {
        if (p.destination_id && idsSet.has(p.destination_id)) return true;
        const cat = (p.category ?? "").trim();
        return cat && namesSet.has(cat);
      });
    } else {
      list = list.filter((p) => {
        const destinationName =
          p.destination_id && map[p.destination_id]
            ? map[p.destination_id].trim()
            : null;
        if (destinationName !== null) {
          return destinationName === r;
        }
        return (p.category ?? "").trim() === r;
      });
    }
  }
  if (filters.theme) {
    const t = filters.theme.trim();
    const useThemeDescendants =
      options?.themeDescendantNames &&
      options?.themeDescendantForName &&
      options.themeDescendantForName.trim() === t;
    if (useThemeDescendants && options!.themeDescendantNames!.length > 0) {
      const namesSet = new Set(options.themeDescendantNames);
      list = list.filter((p) =>
        parseThemeTokens(p.theme).some((token) => namesSet.has(token.trim())),
      );
    } else {
      list = list.filter((p) => parseThemeTokens(p.theme).includes(t));
    }
  }
  if (filters.product_line) {
    const pl = filters.product_line.trim();
    if (pl === PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE) {
      list = list.filter((p) => !p.product_line_id?.trim());
    } else {
      list = list.filter((p) => {
        const lineName =
          p.product_line_id && map[p.product_line_id]
            ? map[p.product_line_id].trim()
            : null;
        if (lineName !== null) {
          return lineName === pl;
        }
        return (p.category ?? "").trim() === pl;
      });
    }
  }
  if (filters.q) {
    const q = filters.q.trim().toLowerCase();
    const tokens = tokenizeListingQueryKeyword(q);
    list = list.filter((p) => {
      const haystack = buildProductsKeywordHaystack(p);
      return tokens.some((token) => haystack.includes(token));
    });
  }

  if (filters.collection) {
    const c = filters.collection.trim();
    const recNames = options?.collectionCampaignNames?.recommend ?? [];
    const popNames = options?.collectionCampaignNames?.popular ?? [];
    const recommendNameSet = new Set(recNames.map((n) => n.trim()).filter(Boolean));
    const popularNameSet = new Set(popNames.map((n) => n.trim()).filter(Boolean));

    if (c === "recommend") {
      list = list.filter(
        (p) =>
          p.is_recommend === true || productMatchesCampaignNameSet(p, recommendNameSet),
      );
    }
    if (c === "popular") {
      list = list.filter(
        (p) =>
          p.is_popular === true || productMatchesCampaignNameSet(p, popularNameSet),
      );
    }
    if (c === "new") {
      list = [...list].sort((a, b) => {
        const aAt = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bAt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bAt - aAt;
      });
    }
  }

  if (filters.sort === "latest" || filters.sort === "new") {
    list = [...list].sort((a, b) => {
      const aAt = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bAt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bAt - aAt;
    });
  } else if (filters.sort === "popular" || filters.sort === "recommended") {
    list = [...list].sort((a, b) => {
      const aOrder = typeof a.sort_order === "number" ? a.sort_order : 9999;
      const bOrder = typeof b.sort_order === "number" ? b.sort_order : 9999;
      return aOrder - bOrder;
    });
  } else if (filters.sort === "price_asc") {
    list = [...list].sort((a, b) => {
      const ap = typeof a.price === "number" && !Number.isNaN(a.price) ? a.price : Number.POSITIVE_INFINITY;
      const bp = typeof b.price === "number" && !Number.isNaN(b.price) ? b.price : Number.POSITIVE_INFINITY;
      return ap - bp;
    });
  } else if (filters.sort === "price_desc") {
    list = [...list].sort((a, b) => {
      const ap = typeof a.price === "number" && !Number.isNaN(a.price) ? a.price : Number.NEGATIVE_INFINITY;
      const bp = typeof b.price === "number" && !Number.isNaN(b.price) ? b.price : Number.NEGATIVE_INFINITY;
      return bp - ap;
    });
  }

  return list;
}
