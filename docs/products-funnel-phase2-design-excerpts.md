# 상품 퍼널 2단계 설계용 코드 발췌

> 정책 단일화·동작 고정(검색/필터/경로/배지) 논의 시 참고. 저장소 스냅샷 기준이며, 원본과 동일하게 맞추려면 해당 경로의 현재 파일을 기준으로 할 것.

---

## 인덱스: 검색어가 나뉘는 두 갈래 (2단계에서 단일화 후보)

| 단계 | 위치 | 동작 |
|------|------|------|
| URL `q` → 목록 필터 | `applyProductFilters` (`filters.q`) | 공백으로 토큰 분리, `title/description/category/theme` join 후 `includes` |
| 카탈로그 칩·탭 내 검색 | `ProductCatalogSection` → `productCatalogMatchesKeyword` | 쉼표·공백 토큰, 동일 haystack 필드 |

`ProductsPageContent`는 서버에서 온 `initialKeyword`를 `ProductCatalogSection`에 넘기고, `filters.q`는 `applyProductFilters`에서 처리한다.

---

## 1) `ProductsPageContent` 전체

`src/components/products/ProductsPageContent.tsx`

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";
import ProductCatalogSection from "@/components/product-detail/ProductCatalogSection";
import { ProductFilterSidebar } from "@/components/products/ProductFilterSidebar";
import { ProductFilterChips } from "@/components/products/ProductFilterChips";
import { MobileProductFilterDrawer } from "@/components/products/MobileProductFilterDrawer";
import { MobileProductSortSheet } from "@/components/products/MobileProductSortSheet";
import { ProductListToolbar } from "@/components/products/ProductListToolbar";
import {
  parseProductFiltersFromSearchParams,
  mergeFiltersIntoSearchParams,
  applyProductFilters,
  SORT_OPTIONS,
  type ProductFiltersState,
  type ProductSortId,
} from "@/lib/productFilters";
import type { Product } from "@/types/product";
import type { RegionTreeNode } from "@/types/productTaxonomy";
import { getSelfAndDescendantIdsAndNames } from "@/lib/productTaxonomies";
import type { ProductsPageContentListingConfig } from "@/lib/products/productsPageContentConfig";

export type { ProductsPageContentListingConfig };

export type ProductsPageContentProps = {
  products: Product[];
  /** id → name (destination_id, product_line_id FK resolve용). 있으면 필터 FK 우선 적용 */
  taxonomyNameMap?: Record<string, string>;
  regionOptions: string[];
  /** 지역 트리(대분류>중분류>소분류). 있으면 좌측 필터에 접이식 트리로 표시 */
  regionTree?: RegionTreeNode[];
  themeOptions: string[];
  /** 테마 트리(부모>자식). 있으면 좌측 필터에 접이식 트리로 표시 */
  themeTree?: RegionTreeNode[];
  productLineOptions: string[];
  initialKeyword?: string;
  presetCategories?: string[];
  presetLabel?: string;
  /** 목록 퍼널 옵션(랜딩·basePath·카드 레이아웃 등). 미전달 시 각 필드 기본값 */
  listing?: ProductsPageContentListingConfig;
};

export function ProductsPageContent({
  products,
  taxonomyNameMap,
  regionOptions,
  regionTree,
  themeOptions,
  themeTree,
  productLineOptions,
  initialKeyword = "",
  presetCategories,
  presetLabel,
  listing,
}: ProductsPageContentProps) {
  const initialFiltersFromServer = listing?.initialFiltersFromServer ?? null;
  const basePath = listing?.basePath ?? "/products";
  const filterContextLabel = listing?.filterContextLabel ?? null;
  const initialRegionDescendants = listing?.initialRegionDescendants ?? null;
  const initialThemeDescendantNames = listing?.initialThemeDescendantNames ?? null;
  const cardLayout = listing?.cardLayout ?? "list";
  const mobileListToolbarBelowBackHeader = listing?.mobileListToolbarBelowBackHeader ?? false;
  const regionTaxonomies = listing?.regionTaxonomies ?? null;
  const themeTaxonomies = listing?.themeTaxonomies ?? null;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  const filters = useMemo(
    () => {
      const hasLanding =
        searchParams.get("destination") ||
        searchParams.get("city") ||
        searchParams.get("theme");
      if (hasLanding && initialFiltersFromServer != null)
        return initialFiltersFromServer;
      // 랜딩 하위 페이지(/products/region/[slug], /products/theme/[slug]) 첫 진입 시 쿼리 없이 서버에서 넘긴 초기 필터 사용
      const hasFilterInUrl =
        searchParams.get("region") ||
        searchParams.get("theme") ||
        searchParams.get("product_line") ||
        searchParams.get("sort") ||
        searchParams.get("q");
      if (!hasFilterInUrl && initialFiltersFromServer != null)
        return initialFiltersFromServer;
      return parseProductFiltersFromSearchParams(
        Object.fromEntries(searchParams.entries()),
      );
    },
    [searchParams, initialFiltersFromServer],
  );

  const baseProducts = useMemo(() => {
    if (!presetCategories?.length) return products;
    const set = new Set(presetCategories.map((c) => c.trim()).filter(Boolean));
    return products.filter((p) => set.has(p.category ?? ""));
  }, [products, presetCategories]);

  const filterApplyOptions = useMemo(() => {
    const regionName = filters.region?.trim();
    const themeName = filters.theme?.trim();

    let regionDescendants: { ids: string[]; names: string[] } | undefined;
    let regionDescendantForName: string | undefined;
    let themeDescendantNames: string[] | undefined;
    let themeDescendantForName: string | undefined;

    // 지역: 랜딩에서 넘긴 하위 집합 우선, 없으면 /products용 flat 목록으로 계산
    const useInitialRegion =
      initialFiltersFromServer?.region &&
      regionName === initialFiltersFromServer.region.trim() &&
      initialRegionDescendants &&
      (initialRegionDescendants.ids.length > 0 || initialRegionDescendants.names.length > 0);
    if (useInitialRegion && initialRegionDescendants) {
      regionDescendants = initialRegionDescendants;
      regionDescendantForName = regionName ?? undefined;
    } else if (regionTaxonomies?.length && regionName) {
      const computed = getSelfAndDescendantIdsAndNames(regionTaxonomies, regionName);
      if (computed.ids.length > 0 || computed.names.length > 0) {
        regionDescendants = computed;
        regionDescendantForName = regionName;
      }
    }

    // 테마: 랜딩에서 넘긴 하위 집합 우선, 없으면 flat 목록으로 계산
    const useInitialTheme =
      initialFiltersFromServer?.theme &&
      themeName === initialFiltersFromServer.theme.trim() &&
      initialThemeDescendantNames &&
      initialThemeDescendantNames.length > 0;
    if (useInitialTheme && initialThemeDescendantNames) {
      themeDescendantNames = initialThemeDescendantNames;
      themeDescendantForName = themeName ?? undefined;
    } else if (themeTaxonomies?.length && themeName) {
      const computed = getSelfAndDescendantIdsAndNames(themeTaxonomies, themeName);
      if (computed.names.length > 0) {
        themeDescendantNames = computed.names;
        themeDescendantForName = themeName;
      }
    }

    if (!regionDescendants && !themeDescendantNames) return undefined;
    return {
      ...(regionDescendants && regionDescendantForName
        ? { regionDescendants, regionDescendantForName }
        : {}),
      ...(themeDescendantNames && themeDescendantForName
        ? { themeDescendantNames, themeDescendantForName }
        : {}),
    };
  }, [
    filters.region,
    filters.theme,
    initialFiltersFromServer,
    initialRegionDescendants,
    initialThemeDescendantNames,
    regionTaxonomies,
    themeTaxonomies,
  ]);

  const filteredProducts = useMemo(
    () => applyProductFilters(baseProducts, filters, taxonomyNameMap, filterApplyOptions),
    [baseProducts, filters, taxonomyNameMap, filterApplyOptions],
  );

  function handleFilterChange(next: Partial<ProductFiltersState>) {
    const nextParams = mergeFiltersIntoSearchParams(searchParams, {
      ...filters,
      ...next,
    });
    const qs = nextParams.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  const sortLabel = filters.sort
    ? SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? null
    : null;

  const handleResetFilters = () => {
    if (initialFiltersFromServer != null) {
      handleFilterChange({
        ...initialFiltersFromServer,
        q: null,
        sort: "",
      });
    } else {
      handleFilterChange({ region: null, theme: null, product_line: null, q: null, sort: "" });
    }
  };

  return (
    <div className="flex w-full max-w-full gap-8 items-start">
      <ProductFilterSidebar
        regionOptions={regionOptions}
        regionTree={regionTree}
        themeOptions={themeOptions}
        themeTree={themeTree}
        productLineOptions={productLineOptions}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      <div className="min-w-0 flex-1 space-y-4">
        <ProductListToolbar
          sortLabel={sortLabel}
          currentSort={filters.sort}
          onFilterClick={() => setFilterDrawerOpen(true)}
          onSortClick={() => setSortSheetOpen(true)}
          onSortChange={(sort) => handleFilterChange({ sort })}
          belowMobileBackHeader={mobileListToolbarBelowBackHeader}
        />

        <div className="space-y-2">
          {filterContextLabel && (
            <p className="type-small text-[var(--text-muted)]" role="status">
              {filterContextLabel}
            </p>
          )}
          <ProductFilterChips
            filters={filters}
            onRemoveRegion={() => handleFilterChange({ region: null })}
            onRemoveTheme={() => handleFilterChange({ theme: null })}
            onRemoveProductLine={() => handleFilterChange({ product_line: null })}
            onRemoveKeyword={() => handleFilterChange({ q: null })}
            onRemoveSort={() => handleFilterChange({ sort: "" })}
          />
        </div>

        <ProductCatalogSection
          products={filteredProducts}
          categories={regionOptions}
          initialKeyword={initialKeyword}
          presetCategories={presetCategories}
          presetLabel={presetLabel}
          initialRegion={filters.region}
          initialTheme={filters.theme}
          onCategoryChange={(region) => handleFilterChange({ region: region ?? null })}
          onThemeChange={(theme) => handleFilterChange({ theme: theme ?? null })}
          onResetFilters={handleResetFilters}
          cardLayout={cardLayout}
        />
      </div>

      <MobileProductFilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        regionOptions={regionOptions}
        regionTree={regionTree}
        themeOptions={themeOptions}
        themeTree={themeTree}
        productLineOptions={productLineOptions}
        filters={filters}
        onApply={(next) => handleFilterChange(next)}
        onReset={handleResetFilters}
      />

      <MobileProductSortSheet
        isOpen={sortSheetOpen}
        onClose={() => setSortSheetOpen(false)}
        currentSort={filters.sort}
        onSelect={(sort: ProductSortId) => handleFilterChange({ sort })}
      />
    </div>
  );
}
```

---

## 2) 필터·정렬·검색 핵심 (`productFilters` + 카탈로그 검색 유틸)

### `src/lib/productFilters.ts` (전체)

```ts
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
  /** 여행추천 메가메뉴용: recommend | popular | new */
  COLLECTION: "collection",
  TOUR_TYPE: "tourType",
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

const SORT_VALUES: ProductSortId[] = ["popular", "latest", "new"];

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
  if (filters.collection != null) {
    if (filters.collection) next.set(PRODUCT_FILTER_KEYS.COLLECTION, filters.collection);
    else next.delete(PRODUCT_FILTER_KEYS.COLLECTION);
  }
  return next;
}

export const SORT_OPTIONS: { value: ProductSortId; label: string }[] = [
  { value: "recommended", label: "추천순" },
  { value: "price_asc", label: "가격 낮은순" },
  { value: "price_desc", label: "가격 높은순" },
  { value: "latest", label: "최신순" },
  { value: "new", label: "신규순" },
  { value: "popular", label: "인기순" },
];

/** 랜딩 페이지에서 상위 지역/테마 선택 시 하위 전체 포함하려면 전달. */
export type ProductFiltersApplyOptions = {
  regionDescendants?: { ids: string[]; names: string[] };
  regionDescendantForName?: string;
  themeDescendantNames?: string[];
  themeDescendantForName?: string;
};

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

  if (filters.collection) {
    const c = filters.collection.trim();
    if (c === "recommend") {
      list = list.filter((p) => p.is_recommend === true);
    }
    if (c === "popular") {
      list = list.filter((p) => p.is_popular === true);
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
```

### `src/lib/products/productCatalogKeyword.ts` (카탈로그 내 검색 — `ProductCatalogSection` 연결)

```ts
import type { Product } from "@/types/product";

export function normalizeProductCatalogSearchKeyword(value: string) {
  return value.trim().toLowerCase();
}

export function productCatalogMatchesKeyword(product: Product, keyword: string) {
  if (!keyword) {
    return true;
  }

  const haystack = [product.title, product.description, product.category, product.theme ?? ""]
    .join(" ")
    .toLowerCase();

  const tokens = keyword
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return true;
  }

  return tokens.some((token) => haystack.includes(token));
}
```

---

## 3) `/products` 페이지 본문 전체

`src/app/products/page.tsx`

```tsx
import SiteHeader from "@/components/site-chrome/SiteHeader";
import ProductsHero from "@/components/product-detail/ProductsHero";
import { PageContainer } from "@/components/layout/PageContainer";
import { NavigationContextHeader } from "@/components/navigation/NavigationContextHeader";
import {
  buildProductsBreadcrumbItems,
  getProductsNavFallbackHref,
} from "@/components/navigation/breadcrumb-config";
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
import { loadProductsListingContext } from "@/lib/products/loadProductsListingContext";
import {
  resolveLandingParams,
  hasLandingParams,
} from "@/lib/productFiltersLanding";

type ProductsPageProps = {
  searchParams?: Promise<{
    q?: string;
    tourType?: string;
    region?: string;
    theme?: string;
    product_line?: string;
    sort?: string;
    collection?: string;
    destination?: string;
    city?: string;
  }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const query = (await searchParams) ?? {};
  const searchKeyword = typeof query.q === "string" ? query.q.trim() : "";
  const tourType = typeof query.tourType === "string" ? query.tourType.trim() : "";
  const golfPresetActive = tourType === "golf-park";
  const presetCategories = golfPresetActive ? ["골프투어", "파크골프투어"] : undefined;
  const listingCtx = await loadProductsListingContext("products_index");
  const {
    products,
    categories,
    themes,
    productLines,
    regionTree,
    themeTree,
    taxonomyNameMap,
    hubDestinations,
    hubThemes,
  } = listingCtx;

  const landingResolved =
    hasLandingParams(query) ? await resolveLandingParams(query) : null;
  const initialFiltersFromServer = landingResolved?.initialFilters ?? null;
  const initialKeywordFromLanding = landingResolved?.initialKeyword ?? "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] text-[var(--text-primary)]">
      <SiteHeader activeTab="products" searchQuery={searchKeyword} golfPresetActive={golfPresetActive} />

      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-6">
          <NavigationContextHeader
            items={buildProductsBreadcrumbItems("index", { currentLabel: "여행상품" })}
            pageTitle="여행상품"
            fallbackHref={getProductsNavFallbackHref("index")}
            withMarginBottom={false}
          />
          <ProductsHero variant={golfPresetActive ? "golf" : "package"} />

          {products.length === 0 ? (
            <section className="rounded-2xl bg-[var(--surface)] p-8 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] type-small text-[var(--text-muted)] sm:rounded-3xl">
              현재 등록된 상품이 없습니다. 관리자 페이지에서 상품을 등록해 주세요.
            </section>
          ) : (
            <ProductsPageContent
              products={products}
              taxonomyNameMap={taxonomyNameMap}
              regionOptions={categories}
              regionTree={regionTree}
              themeOptions={themes}
              themeTree={themeTree}
              productLineOptions={productLines}
              initialKeyword={initialKeywordFromLanding || searchKeyword}
              presetCategories={presetCategories}
              presetLabel={golfPresetActive ? "골프/파크골프" : undefined}
              listing={{
                initialFiltersFromServer,
                regionTaxonomies: hubDestinations,
                themeTaxonomies: hubThemes,
                mobileListToolbarBelowBackHeader: true,
              }}
            />
          )}
        </PageContainer>
      </main>
    </div>
  );
}
```

---

## 4) `/products/region/[slug]` 전체

`src/app/products/region/[slug]/page.tsx`

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTaxonomyNameBySlug } from "@/lib/productTaxonomies";
import { getProductLandingData } from "@/lib/productLanding";
import ProductLandingPage from "@/components/products/landing/ProductLandingPage";
import {
  buildProductsBreadcrumbItems,
  getProductsNavFallbackHref,
} from "@/components/navigation/breadcrumb-config";
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { loadProductRegionLandingMetadata } from "@/lib/landing/productSlugLandingMetadata";
import { loadProductsRegionLandingPageBundle } from "@/lib/landing/loadProductsSlugLandingPage";

type RegionLandingProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: RegionLandingProps): Promise<Metadata> {
  const { slug } = await params;
  const trimmed = slug?.trim() ?? "";
  return loadProductRegionLandingMetadata(trimmed);
}

/**
 * 지역 랜딩: /products/region/[slug]
 * 랜딩 데이터가 유효하면 새 랜딩 UI 렌더, 아니면 기존대로 /products?region={name} redirect.
 */
export default async function ProductsRegionSlugPage({ params }: RegionLandingProps) {
  const { slug } = await params;
  const trimmedSlug = slug?.trim();
  if (!trimmedSlug) {
    redirect("/products");
  }

  const landingData = await getProductLandingData({ type: "region", slug: trimmedSlug });
  const name = await getTaxonomyNameBySlug("category", trimmedSlug);

  if (landingData && landingData.taxonomyName && landingData.hero?.primaryCtaHref) {
    const { dataWithChildren, listing, initialFiltersFromServer, initialRegionDescendants } =
      await loadProductsRegionLandingPageBundle(trimmedSlug, landingData);
    const {
      products,
      categories,
      themes,
      productLines,
      regionTree,
      themeTree,
      taxonomyNameMap,
    } = listing;

    return (
      <>
        <SiteHeader activeTab="products" />
        <ProductLandingPage
          data={dataWithChildren}
          navigationContext={{
            items: buildProductsBreadcrumbItems("region", {
              currentLabel: landingData.taxonomyName,
            }),
            pageTitle: landingData.taxonomyName,
            fallbackHref: getProductsNavFallbackHref("region"),
          }}
        />
        <section
          className="min-h-screen border-t border-[var(--border)] bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] pt-10 mt-12 sm:mt-16"
          aria-labelledby="products-section-heading"
        >
          <div className="mx-auto w-full max-w-6xl px-3 py-8 sm:px-6 sm:py-10 md:px-10 md:py-14">
            <div className="flex flex-col gap-8">
              <h2
                id="products-section-heading"
                className="section-heading type-h2 text-[var(--foreground)] first:mt-0"
              >
                {landingData.taxonomyName} 여행 상품 전체 보기
              </h2>
              <p className="section-description type-small text-[var(--text-muted)] -mt-4">
                조건을 변경하여 다양한 상품을 비교해보세요.
              </p>
              <ProductsPageContent
                products={products}
                taxonomyNameMap={taxonomyNameMap}
                regionOptions={categories}
                regionTree={regionTree}
                themeOptions={themes}
                themeTree={themeTree}
                productLineOptions={productLines}
                listing={{
                  initialFiltersFromServer,
                  basePath: `/products/region/${trimmedSlug}`,
                  filterContextLabel: `현재 '${landingData.taxonomyName}' 기준으로 상품을 보여주고 있습니다.`,
                  initialRegionDescendants,
                  cardLayout: "related",
                  mobileListToolbarBelowBackHeader: true,
                }}
              />
            </div>
          </div>
        </section>
      </>
    );
  }

  if (!name) {
    redirect("/products");
  }
  redirect(`/products?region=${encodeURIComponent(name)}`);
}
```

---

## 5) `/products/theme/[slug]` 전체

`src/app/products/theme/[slug]/page.tsx`

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTaxonomyNameBySlug } from "@/lib/productTaxonomies";
import { getProductLandingData } from "@/lib/productLanding";
import ProductLandingPage from "@/components/products/landing/ProductLandingPage";
import {
  buildProductsBreadcrumbItems,
  getProductsNavFallbackHref,
} from "@/components/navigation/breadcrumb-config";
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { loadProductThemeLandingMetadata } from "@/lib/landing/productSlugLandingMetadata";
import { loadProductsThemeLandingPageBundle } from "@/lib/landing/loadProductsSlugLandingPage";

type ThemeLandingProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ThemeLandingProps): Promise<Metadata> {
  const { slug } = await params;
  const trimmed = slug?.trim() ?? "";
  return loadProductThemeLandingMetadata(trimmed);
}

/**
 * 테마 랜딩: /products/theme/[slug]
 * 랜딩 데이터가 유효하면 새 랜딩 UI 렌더, 아니면 기존대로 /products?theme={name} redirect.
 */
export default async function ProductsThemeSlugPage({ params }: ThemeLandingProps) {
  const { slug } = await params;
  const trimmedSlug = slug?.trim();
  if (!trimmedSlug) {
    redirect("/products");
  }

  const landingData = await getProductLandingData({ type: "theme", slug: trimmedSlug });
  const name = await getTaxonomyNameBySlug("theme", trimmedSlug);

  if (landingData && landingData.taxonomyName && landingData.hero?.primaryCtaHref) {
    const { dataWithChildren, listing, initialFiltersFromServer, initialThemeDescendantNames } =
      await loadProductsThemeLandingPageBundle(trimmedSlug, landingData);
    const {
      products,
      categories,
      themes,
      productLines,
      regionTree,
      themeTree,
      taxonomyNameMap,
    } = listing;

    return (
      <>
        <SiteHeader activeTab="products" />
        <ProductLandingPage
          data={dataWithChildren}
          navigationContext={{
            items: buildProductsBreadcrumbItems("theme", {
              currentLabel: landingData.taxonomyName,
            }),
            pageTitle: landingData.taxonomyName,
            fallbackHref: getProductsNavFallbackHref("theme"),
          }}
        />
        <section
          className="min-h-screen border-t border-[var(--border)] bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] pt-10 mt-12 sm:mt-16"
          aria-labelledby="products-section-heading"
        >
          <div className="mx-auto w-full max-w-6xl px-3 py-8 sm:px-6 sm:py-10 md:px-10 md:py-14">
            <div className="flex flex-col gap-8">
              <h2
                id="products-section-heading"
                className="section-heading type-h2 text-[var(--foreground)] first:mt-0"
              >
                {landingData.taxonomyName} 여행 상품 전체 보기
              </h2>
              <p className="section-description type-small text-[var(--text-muted)] -mt-4">
                조건을 변경하여 다양한 상품을 비교해보세요.
              </p>
              <ProductsPageContent
                products={products}
                taxonomyNameMap={taxonomyNameMap}
                regionOptions={categories}
                regionTree={regionTree}
                themeOptions={themes}
                themeTree={themeTree}
                productLineOptions={productLines}
                listing={{
                  initialFiltersFromServer,
                  basePath: `/products/theme/${trimmedSlug}`,
                  filterContextLabel: `현재 '${landingData.taxonomyName}' 테마 기준 결과입니다.`,
                  initialThemeDescendantNames,
                  cardLayout: "related",
                  mobileListToolbarBelowBackHeader: true,
                }}
              />
            </div>
          </div>
        </section>
      </>
    );
  }

  if (!name) {
    redirect("/products");
  }
  redirect(`/products?theme=${encodeURIComponent(name)}`);
}
```

---

## 6) 랜딩 상단 + 하단 목록 컴포넌트

### `src/components/products/landing/ProductLandingPage.tsx` (전체)

```tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ProductLandingData, ProductLandingProductSummary } from "@/types/productLanding";
import { getDestinationLandingHref, getThemeLandingHref } from "@/lib/hubLandingLinks";
import { trackLandingCtaClick } from "@/lib/analytics/trackLandingCta";
import { buildLandingCtaPayload } from "@/lib/analytics/landingCtaPayload";
import { HeroVisual } from "@/components/landing/HeroVisual";
import { HubBrowseCard } from "@/components/landing/HubBrowseCard";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { NavigationContextHeader } from "@/components/navigation/NavigationContextHeader";
import type { BreadcrumbItem } from "@/components/navigation/Breadcrumb";

export type ProductLandingNavigationContext = {
  items: BreadcrumbItem[];
  pageTitle: string;
  fallbackHref: string;
};

export type ProductLandingPageProps = {
  data: ProductLandingData;
  /** 지역/테마 랜딩 상단: 모바일 백 + 데스크톱 브레드크럼 */
  navigationContext?: ProductLandingNavigationContext;
};

export default function ProductLandingPage({ data, navigationContext }: ProductLandingPageProps) {
  const { hero, featuredLinks, recommendedProducts, relatedTaxonomies, type, taxonomyName, productCount, childDestinations, childThemes } = data;

  /** 동일 id 중복 제거 (React key 충돌 방지) */
  const uniqueRecommendedProducts = useMemo(() => {
    const seen = new Set<string>();
    return recommendedProducts.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [recommendedProducts]);

  const relatedTitle = type === "region" ? "함께 살펴볼 테마" : "함께 살펴볼 지역";
  const relatedDescription =
    type === "region"
      ? `${taxonomyName} 여행과 함께 많이 찾는 테마를 둘러보세요.`
      : `${taxonomyName} 테마로 많이 찾는 지역을 확인해보세요.`;
  const moreProductsLabel = type === "region" ? "이 지역 상품 더 보기" : "이 테마 상품 더 보기";

  const basePayload = buildLandingCtaPayload(data, "hero");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] text-[var(--text-primary)]">
      <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-10 md:px-10 md:py-14">
        <div className="flex flex-col gap-10">
          {navigationContext ? (
            <NavigationContextHeader
              items={navigationContext.items}
              pageTitle={navigationContext.pageTitle}
              fallbackHref={navigationContext.fallbackHref}
              withMarginBottom={false}
            />
          ) : null}
          {/* Hero: 이미지 있으면 배경 히어로, 없으면 카드 스타일 */}
          {hero.imageUrl ? (
            <HeroVisual
              imageUrl={hero.imageUrl}
              priority
              contentClassName="max-w-[680px] gap-2"
            >
              {hero.eyebrow ? (
                <p className="hero-text-shadow-body text-sm font-semibold text-white/92">{hero.eyebrow}</p>
              ) : null}
              <h1 className="hero-text-shadow-title text-2xl font-bold leading-tight text-white sm:text-3xl">
                {hero.title}
              </h1>
              {hero.description ? (
                <p className="hero-text-shadow-body max-w-2xl text-sm text-white/90 sm:text-base">
                  {hero.description}
                </p>
              ) : null}
              {productCount > 0 ? (
                <p className="inline-flex w-fit rounded-lg border border-white/25 bg-black/20 px-2.5 py-1 text-sm text-white/90 backdrop-blur-sm">
                  총 {productCount}개 상품
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={hero.primaryCtaHref}
                  className={cn(
                    "inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90",
                    solidButtonShadowClasses,
                  )}
                  onClick={() =>
                    trackLandingCtaClick({
                      ...basePayload,
                      section: "hero",
                      label: hero.primaryCtaLabel,
                      href: hero.primaryCtaHref,
                    })
                  }
                >
                  {hero.primaryCtaLabel}
                </Link>
                {hero.secondaryCtaLabel && hero.secondaryCtaHref ? (
                  <Link
                    href={hero.secondaryCtaHref}
                    className="inline-flex items-center justify-center rounded-xl border border-white/60 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                    onClick={() =>
                      trackLandingCtaClick({
                        ...basePayload,
                        section: "hero",
                        label: hero.secondaryCtaLabel!,
                        href: hero.secondaryCtaHref!,
                      })
                    }
                  >
                    {hero.secondaryCtaLabel}
                  </Link>
                ) : null}
              </div>
            </HeroVisual>
          ) : (
          <section className="rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] sm:p-8">
            {hero.eyebrow ? (
              <p className="text-sm font-semibold text-[var(--text-muted)]">{hero.eyebrow}</p>
            ) : null}
            <h1 className="mt-2 text-2xl font-bold text-[var(--foreground)] sm:text-3xl">{hero.title}</h1>
            {hero.description ? (
              <p className="mt-3 text-[var(--text-muted)] sm:text-base">{hero.description}</p>
            ) : null}
            {productCount > 0 ? (
              <p className="mt-2 text-sm text-[var(--text-muted)]">총 {productCount}개 상품</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={hero.primaryCtaHref}
                className={cn(
                  "inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90",
                  solidButtonShadowClasses,
                )}
                onClick={() =>
                  trackLandingCtaClick({
                    ...basePayload,
                    section: "hero",
                    label: hero.primaryCtaLabel,
                    href: hero.primaryCtaHref,
                  })
                }
              >
                {hero.primaryCtaLabel}
              </Link>
              {hero.secondaryCtaLabel && hero.secondaryCtaHref ? (
                <Link
                  href={hero.secondaryCtaHref}
                  className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                  onClick={() =>
                    trackLandingCtaClick({
                      ...basePayload,
                      section: "hero",
                      label: hero.secondaryCtaLabel!,
                      href: hero.secondaryCtaHref!,
                    })
                  }
                >
                  {hero.secondaryCtaLabel}
                </Link>
              ) : null}
            </div>
          </section>
          )}

          {/* 도시·지역 선택 (region 랜딩이고 소분류가 있을 때만) */}
          {type === "region" && childDestinations && childDestinations.length > 0 ? (
            <section>
              <h2 className="text-lg font-bold text-[var(--foreground)]">도시·지역 선택</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">원하는 도시·지역을 선택해 보세요.</p>
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {childDestinations.map((d) => (
                  <li key={d.id}>
                    <HubBrowseCard
                      item={d}
                      href={getDestinationLandingHref(d)}
                      showImage={true}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* 세부 테마 선택 (theme 랜딩이고 하위 테마가 있을 때만) */}
          {type === "theme" && childThemes && childThemes.length > 0 ? (
            <section>
              <h2 className="text-lg font-bold text-[var(--foreground)]">세부 테마 선택</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">원하는 테마를 선택해 보세요.</p>
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {childThemes.map((t) => (
                  <li key={t.id}>
                    <HubBrowseCard
                      item={t}
                      href={getThemeLandingHref(t)}
                      showImage={true}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* 바로가기 링크 묶음 */}
          {featuredLinks.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold text-[var(--text-muted)]">바로가기</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {featuredLinks.slice(0, 4).map((link) => (
                  <Link
                    key={link.key}
                    href={link.href}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* 추천 상품 그리드 */}
          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-bold text-[var(--foreground)]">추천 상품</h2>
              {productCount > 0 && uniqueRecommendedProducts.length > 0 ? (
                <p className="text-sm text-[var(--text-muted)]">현재 {productCount}개 상품을 확인할 수 있습니다.</p>
              ) : null}
            </div>
            {uniqueRecommendedProducts.length === 0 ? (
              <div className="mt-3 space-y-4">
                <p className="rounded-xl bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)] ring-1 ring-[var(--border)]">
                  현재 준비된 추천 상품이 없습니다. 전체 상품 목록에서 더 많은 상품을 확인해보세요.
                </p>
                <div className="flex justify-end">
                  <Link
                    href={hero.primaryCtaHref}
                    className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                    onClick={() =>
                      trackLandingCtaClick({
                        ...buildLandingCtaPayload(data, "recommended_products"),
                        section: "recommended_products",
                        label: "전체 상품 보기",
                        href: hero.primaryCtaHref,
                      })
                    }
                  >
                    전체 상품 보기
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <ProductCardGridSection desktopGridCols={2}>
                  {uniqueRecommendedProducts.map((item) => (
                    <ProductCard
                      key={item.id}
                      layout="grid"
                      title={item.title}
                      price={item.price ?? undefined}
                      region={item.themes?.join(", ")}
                      categories={item.categories ?? []}
                      status="AVAILABLE"
                      badges={item.badges ?? []}
                      thumbnailUrl={item.imageUrl ?? ""}
                      hrefDetail={item.href}
                      analyticsSource="landing"
                      analyticsSection={`${data.type}_${data.taxonomySlug ?? data.slug ?? ""}`}
                      productId={item.id}
                    />
                  ))}
                </ProductCardGridSection>
                <div className="mt-4 flex justify-end">
                  <Link
                    href={hero.primaryCtaHref}
                    className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)] sm:px-5"
                    onClick={() =>
                      trackLandingCtaClick({
                        ...buildLandingCtaPayload(data, "recommended_products"),
                        section: "recommended_products",
                        label: moreProductsLabel,
                        href: hero.primaryCtaHref,
                      })
                    }
                  >
                    {moreProductsLabel}
                  </Link>
                </div>
              </>
            )}
          </section>

          {/* 관련 taxonomy 링크 */}
          {relatedTaxonomies.length > 0 ? (
            <section>
              <h2 className="text-lg font-bold text-[var(--foreground)]">{relatedTitle}</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{relatedDescription}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {relatedTaxonomies.slice(0, 6).map((link) => (
                  <Link
                    key={link.key}
                    href={link.href}
                    className="inline-flex min-h-[44px] items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
```

### `src/components/product-detail/ProductCatalogSection.tsx` (전체)

```tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Product } from "@/types/product";
import ProductListCard from "@/components/products/ProductListCard";
import ProductListCardMobile from "@/components/products/ProductListCardMobile";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";
import { useConsultModal } from "@/components/inquiry/ConsultModal";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  getThemeTabs,
  groupProductsByTheme,
  matchesThemeTab,
  matchesProductTab,
  type ProductCategoryTabId,
} from "@/lib/productCategory";
import {
  normalizeProductCatalogSearchKeyword,
  productCatalogMatchesKeyword,
} from "@/lib/products/productCatalogKeyword";

/** 지역 칩 첫 항목 라벨 (내부 탭 id는 `all`) */
const REGION_ALL_LABEL = "전체";
/** 테마 칩 전체 (matchesThemeTab / getThemeTabs 와 동일) */
const THEME_ALL_LABEL = "전체";

type ProductCatalogSectionProps = {
  products: Product[];
  categories: string[];
  initialKeyword?: string;
  presetCategories?: string[];
  presetLabel?: string;
  /** URL 연동 시 초기 지역(상품 category 문자열) */
  initialRegion?: string | null;
  /** URL 연동 시 초기 테마 */
  initialTheme?: string | null;
  /** URL 연동 시 지역 변경 콜백 */
  onCategoryChange?: (region: string | null) => void;
  /** URL 연동 시 테마 변경 콜백 */
  onThemeChange?: (theme: string | null) => void;
  /** 결과 0건일 때 필터 초기화 CTA */
  onResetFilters?: () => void;
  /** list: /products 목록형. related: 연관·랜딩용 카드 그리드 */
  cardLayout?: "list" | "related";
};

export default function ProductCatalogSection({
  products,
  categories,
  initialKeyword = "",
  presetCategories,
  presetLabel,
  initialRegion,
  initialTheme,
  onCategoryChange,
  onThemeChange,
  onResetFilters,
  cardLayout = "list",
}: ProductCatalogSectionProps) {
  const [internalTab, setInternalTab] = useState<ProductCategoryTabId>("all");
  const [internalThemeTab, setInternalThemeTab] = useState(THEME_ALL_LABEL);

  const isUrlControlled = onCategoryChange != null && onThemeChange != null;
  const activeTab: ProductCategoryTabId = isUrlControlled
    ? (initialRegion ?? "all")
    : internalTab;
  const activeThemeTab = isUrlControlled ? (initialTheme ?? THEME_ALL_LABEL) : internalThemeTab;

  useEffect(() => {
    if (!isUrlControlled) return;
    setInternalTab(initialRegion ?? "all");
    setInternalThemeTab(initialTheme ?? THEME_ALL_LABEL);
  }, [isUrlControlled, initialRegion, initialTheme]);

  const keyword = useMemo(
    () => normalizeProductCatalogSearchKeyword(initialKeyword),
    [initialKeyword],
  );
  const presetCategorySet = useMemo(
    () => new Set((presetCategories ?? []).map((item) => item.trim()).filter(Boolean)),
    [presetCategories],
  );
  const baseProducts = useMemo(
    () =>
      presetCategorySet.size > 0
        ? products.filter((product) => presetCategorySet.has(product.category))
        : products,
    [products, presetCategorySet],
  );
  const visibleCategories = useMemo(
    () => (presetCategorySet.size > 0 ? categories.filter((category) => presetCategorySet.has(category)) : categories),
    [categories, presetCategorySet],
  );
  const categoryTabs = useMemo(() => [REGION_ALL_LABEL, ...visibleCategories], [visibleCategories]);

  const filteredProducts = useMemo(() => {
    if (isUrlControlled) return baseProducts;
    return baseProducts.filter((product) => matchesProductTab(product, activeTab));
  }, [baseProducts, activeTab, isUrlControlled]);

  const themeTabs = useMemo(() => {
    const inferred = getThemeTabs(baseProducts, activeTab);
    return Array.from(new Set(inferred));
  }, [baseProducts, activeTab]);

  const themeFilteredProducts = useMemo(() => {
    if (isUrlControlled) return filteredProducts;
    return filteredProducts.filter((product) => matchesThemeTab(product, activeThemeTab));
  }, [filteredProducts, activeThemeTab, isUrlControlled]);

  const keywordFilteredProducts = useMemo(
    () =>
      (isUrlControlled ? filteredProducts : themeFilteredProducts).filter((product) =>
        productCatalogMatchesKeyword(product, keyword),
      ),
    [isUrlControlled, filteredProducts, themeFilteredProducts, keyword],
  );

  const groupedByTheme = useMemo(
    () => groupProductsByTheme(keywordFilteredProducts, themeTabs),
    [keywordFilteredProducts, themeTabs],
  );

  const displayGroups = useMemo(
    () =>
      groupedByTheme.length > 0
        ? groupedByTheme
        : keywordFilteredProducts.length > 0
          ? [{ theme: "상품", products: keywordFilteredProducts }]
          : [],
    [groupedByTheme, keywordFilteredProducts],
  );

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openModal } = useConsultModal();

  function handleProductConsult(product: Product) {
    const query = searchParams.toString();
    openModal({
      productId: product.id,
      productTitle: product.title,
      sourcePath: query ? `${pathname}?${query}` : pathname,
    });
  }

  const regionSummary = activeTab === "all" ? REGION_ALL_LABEL : activeTab;

  return (
    <section className="space-y-4">
      <div className="sticky top-[76px] z-20 rounded-xl border border-[var(--border)] bg-[var(--surface)]/98 px-3 py-2.5 backdrop-blur sm:rounded-xl sm:px-3 sm:py-3">
        <div className="space-y-1">
          <p className="text-xs leading-snug text-[var(--text-muted)] sm:text-sm">
            총 {keywordFilteredProducts.length}개 · 지역 {regionSummary}
          </p>
          {presetLabel ? (
            <p className="text-xs leading-snug text-[#15803d] sm:text-sm">프리셋: {presetLabel}</p>
          ) : null}
          {keyword ? (
            <p className="text-xs leading-snug text-[var(--primary)] sm:text-sm">
              검색어: {initialKeyword}
            </p>
          ) : null}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {categoryTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                if (isUrlControlled && onCategoryChange) {
                  onCategoryChange(tab === REGION_ALL_LABEL ? null : tab);
                  return;
                }
                setInternalTab(tab === REGION_ALL_LABEL ? "all" : tab);
                setInternalThemeTab(THEME_ALL_LABEL);
              }}
              className={`min-h-[32px] rounded-full px-3 py-1.5 text-sm font-medium transition ${
                (tab === REGION_ALL_LABEL ? "all" : tab) === activeTab
                  ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {themeTabs.map((tab) => (
            <button
              key={`theme-${tab}`}
              type="button"
              onClick={() => {
                if (isUrlControlled && onThemeChange) {
                  onThemeChange(tab === THEME_ALL_LABEL ? null : tab);
                  return;
                }
                setInternalThemeTab(tab);
              }}
              className={`min-h-[28px] rounded-full px-2.5 py-1 text-xs font-semibold transition sm:min-h-[32px] sm:px-3 sm:py-1.5 sm:text-sm ${
                activeThemeTab === tab
                  ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div key={`${activeTab}-${activeThemeTab}`} className="fade-in-up space-y-5">
        {keywordFilteredProducts.length === 0 ? (
          <div className="rounded-2xl bg-[var(--surface)] p-8 type-small text-[var(--text-muted)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] sm:rounded-3xl">
            {(initialRegion || initialTheme || (initialKeyword && initialKeyword.trim())) && onResetFilters ? (
              <>
                <p className="font-semibold text-[var(--text-primary)]">
                  선택한 조건에 맞는 상품이 없습니다.
                </p>
                <p className="mt-2 text-[var(--text-secondary)]">
                  {[
                    initialRegion && `지역: ${initialRegion}`,
                    initialTheme && `테마: ${initialTheme}`,
                    initialKeyword?.trim() && `검색어: ${initialKeyword.trim()}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href="/products"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 type-btn font-semibold text-[var(--on-primary)] transition hover:opacity-90",
                      solidButtonShadowClasses,
                    )}
                  >
                    전체 상품 보기
                  </Link>
                  <button
                    type="button"
                    onClick={onResetFilters}
                    className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 type-btn font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                  >
                    필터 초기화
                  </button>
                </div>
              </>
            ) : keyword ? (
              "검색 조건에 맞는 상품이 없습니다."
            ) : (
              "표시할 상품이 없습니다. 지역·테마 칩을 바꿔 보세요."
            )}
          </div>
        ) : (
          displayGroups.map((group) => (
            <div key={group.theme} className="space-y-3">
              <h3 className="font-card-title type-h3 text-[var(--primary)]">{group.theme}</h3>
              {cardLayout === "related" ? (
                <ProductCardGridSection desktopGridCols={2} className="w-full max-w-[1344px]">
                  {group.products.map((product) => (
                    <ProductCard
                      key={product.id}
                      {...productToProductCardProps(product, {
                        layout: "related",
                        analyticsSource: "landing",
                        analyticsSection: "landing_catalog",
                      })}
                    />
                  ))}
                </ProductCardGridSection>
              ) : (
                <div className="flex w-full max-w-[1344px] flex-col gap-4 md:gap-5">
                  {group.products.map((product) => {
                    const catalogOverrides = {
                      analyticsSource: "product_list" as const,
                      analyticsSection: "catalog",
                      onClickDetail: () => router.push(`/products/${product.id}`),
                      onClickConsult: () => handleProductConsult(product),
                      /** /destinations 추천 카드와 동일하게 대표 배지 최대 2개(이미지 오버레이) */
                      campaignBadgeMax: 2,
                    };

                    return (
                      <div key={product.id} className="w-full">
                        <div className="hidden md:block">
                          <ProductListCard
                            {...productToProductCardProps(product, {
                              ...catalogOverrides,
                              campaignPresentationKind: "list",
                            })}
                          />
                        </div>
                        <div className="md:hidden">
                          <ProductListCardMobile
                            {...productToProductCardProps(product, {
                              ...catalogOverrides,
                              campaignPresentationKind: "mobile",
                            })}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
```

---

## 7) listing config 전체

`src/lib/products/productsPageContentConfig.ts`

```ts
import type { ProductFiltersState } from "@/lib/productFilters";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

/** `ProductsPageContent` 랜딩·목록 퍼널 옵션 — page 호출부에서 객체 하나로 전달 */
export type ProductsPageContentListingConfig = {
  initialFiltersFromServer?: ProductFiltersState | null;
  basePath?: string;
  filterContextLabel?: string | null;
  initialRegionDescendants?: { ids: string[]; names: string[] } | null;
  initialThemeDescendantNames?: string[] | null;
  cardLayout?: "list" | "related";
  mobileListToolbarBelowBackHeader?: boolean;
  regionTaxonomies?: ProductTaxonomy[] | null;
  themeTaxonomies?: ProductTaxonomy[] | null;
};
```

---

## 8) pathname 정책 관련 전체

### `src/lib/routing/getProductsFunnelPathKind.ts`

```ts
export const PRODUCTS_ROOT = "/products";
export const PRODUCTS_REGION_HUB = `${PRODUCTS_ROOT}/region`;
export const PRODUCTS_THEME_HUB = `${PRODUCTS_ROOT}/theme`;

/**
 * `/products` 퍼널 pathname 단일 분류 — 내비·fallback·경로 종류 판별의 공통 소스.
 */
export type ProductsFunnelPathKind =
  | "outside"
  | "products_root"
  | "products_region_hub"
  | "products_theme_hub"
  | "products_region_landing"
  | "products_theme_landing"
  | "products_product_detail"
  /** `/products/...` 이지만 위 범주에 해당하지 않음 (예: 중첩 세그먼트) */
  | "products_other";

export function getProductsFunnelPathKind(pathname: string): ProductsFunnelPathKind {
  const p = pathname.split("?")[0] ?? pathname;
  if (p === PRODUCTS_ROOT) return "products_root";
  if (p === PRODUCTS_REGION_HUB) return "products_region_hub";
  if (p === PRODUCTS_THEME_HUB) return "products_theme_hub";
  if (!p.startsWith(`${PRODUCTS_ROOT}/`)) return "outside";
  const rest = p.slice(PRODUCTS_ROOT.length + 1);
  if (!rest || rest.includes("//")) return "products_other";
  if (rest.startsWith("region/")) {
    const slug = rest.slice("region/".length);
    if (slug.length > 0 && !slug.includes("/")) return "products_region_landing";
    return "products_other";
  }
  if (rest.startsWith("theme/")) {
    const slug = rest.slice("theme/".length);
    if (slug.length > 0 && !slug.includes("/")) return "products_theme_landing";
    return "products_other";
  }
  if (!rest.includes("/") && rest.length > 0) {
    if (rest === "region" || rest === "theme") return "products_other";
    return "products_product_detail";
  }
  return "products_other";
}
```

### `src/lib/navigation/productsNavigationPolicy.ts`

```ts
/**
 * 상품 탐색 퍼널(/products 계열) 전용 네비게이션 노출 정책.
 * 홈·결제·로그인 등과 분리해 추후 page group 확장 시 이 모듈만 확장하면 됩니다.
 */

import { getFallbackPath } from "@/lib/navigation/getFallbackPath";
import {
  getProductsFunnelPathKind,
  PRODUCTS_REGION_HUB,
  PRODUCTS_THEME_HUB,
} from "@/lib/routing/getProductsFunnelPathKind";

export { PRODUCTS_REGION_HUB, PRODUCTS_THEME_HUB };

/**
 * NavigationContextHeader(MobileBack + Desktop Breadcrumb)를 붙일지 여부.
 */
export function showProductsNavigationContext(pathname: string): boolean {
  const k = getProductsFunnelPathKind(pathname);
  return (
    k === "products_root" ||
    k === "products_region_hub" ||
    k === "products_theme_hub" ||
    k === "products_region_landing" ||
    k === "products_theme_landing" ||
    k === "products_product_detail"
  );
}

export type ProductsNavPathKind =
  | "products_index"
  | "product_detail"
  | "products_region"
  | "products_theme"
  | "products_region_hub"
  | "products_theme_hub"
  | "unknown";

export function getProductsNavPathKind(pathname: string): ProductsNavPathKind {
  const k = getProductsFunnelPathKind(pathname);
  switch (k) {
    case "products_root":
      return "products_index";
    case "products_region_hub":
      return "products_region_hub";
    case "products_theme_hub":
      return "products_theme_hub";
    case "products_region_landing":
      return "products_region";
    case "products_theme_landing":
      return "products_theme";
    case "products_product_detail":
      return "product_detail";
    default:
      return "unknown";
  }
}

/**
 * 직접 URL 진입 등 history가 없을 때 router.push 할 경로.
 */
export function getProductsBackFallbackFromPathname(pathname: string): string {
  return getFallbackPath(pathname);
}
```

### `src/lib/navigation/getFallbackPath.ts`

```ts
import { getProductsFunnelPathKind } from "@/lib/routing/getProductsFunnelPathKind";

/**
 * 모바일 뒤로가기 시 history가 없을 때 사용할 안전 fallback.
 * 허브(`/products/region`, `/products/theme`)는 상위로 한 단계씩 올라갑니다.
 */
export function getFallbackPath(pathname: string): string {
  const p = pathname.split("?")[0] ?? pathname;
  const k = getProductsFunnelPathKind(p);
  switch (k) {
    case "products_region_landing":
      return "/products/region";
    case "products_region_hub":
      return "/products";
    case "products_theme_landing":
      return "/products/theme";
    case "products_theme_hub":
      return "/products";
    case "products_product_detail":
    case "products_other":
      return "/products";
    case "products_root":
      return "/";
    case "outside":
    default:
      return "/";
  }
}
```

### `src/components/navigation/breadcrumb-config.ts`

```ts
import type { BreadcrumbItem } from "@/components/navigation/Breadcrumb";
import {
  PRODUCTS_REGION_HUB,
  PRODUCTS_THEME_HUB,
} from "@/lib/routing/getProductsFunnelPathKind";

/**
 * 상품 탐색 퍼널 page type — 라벨/트레일 생성 시 단일 진입점.
 */
export type ProductsNavKind = "index" | "product_detail" | "region" | "theme";

const LABELS = {
  home: "홈",
  catalog: "여행상품",
  regionHub: "지역별 상품",
  themeHub: "테마별 상품",
} as const;

export type BuildProductsBreadcrumbParams = {
  /** 화면에 표시할 현재 구간 제목 (상품명·택소노미 표시명 등) */
  currentLabel: string;
};

/**
 * products 계열 페이지용 브레드크럼 아이템 (마지막은 현재 페이지, href 없음).
 * 표시명은 서버에서 `getTaxonomyNameBySlug` 등과 맞춘 `currentLabel`을 넘깁니다.
 */
export function buildProductsBreadcrumbItems(
  kind: ProductsNavKind,
  params: BuildProductsBreadcrumbParams,
): BreadcrumbItem[] {
  const root: BreadcrumbItem = { label: LABELS.home, href: "/" };
  const catalog: BreadcrumbItem = { label: LABELS.catalog, href: "/products" };

  switch (kind) {
    case "index":
      return [root, { label: LABELS.catalog }];
    case "product_detail":
      return [root, catalog, { label: params.currentLabel }];
    case "region":
      return [
        root,
        catalog,
        { label: LABELS.regionHub, href: PRODUCTS_REGION_HUB },
        { label: params.currentLabel },
      ];
    case "theme":
      return [
        root,
        catalog,
        { label: LABELS.themeHub, href: PRODUCTS_THEME_HUB },
        { label: params.currentLabel },
      ];
  }
}

export function getProductsNavFallbackHref(kind: ProductsNavKind): string {
  switch (kind) {
    case "index":
      return "/";
    case "product_detail":
      return "/products";
    case "region":
      return PRODUCTS_REGION_HUB;
    case "theme":
      return PRODUCTS_THEME_HUB;
  }
}
```

---

## 9) 캠페인 배지 — 소스·해석·카드 주입 경로

### 핵심 모듈

| 파일 | 역할 |
|------|------|
| `src/lib/productCampaignBadges.ts` | `buildCampaignRepresentativeBadges` — `campaign_card_meta` 우선, 레거시 라벨·`is_*` fallback |
| `src/lib/productCampaignResolve.ts` | `resolveProductCampaignCardMeta`, `hydrateProductsWithCampaignCardMeta` |
| `src/types/productCampaignCard.ts` | `CampaignBadgeTone`, `ProductCampaignCardMeta` |
| `src/lib/productCardProps.ts` | `productToProductCardProps` → `buildCampaignRepresentativeBadges`, `CAMPAIGN_BADGE_MAX`, `campaignBadgeMax` 오버라이드 |
| `src/lib/productLanding.ts` | 랜딩 요약 `badges`: `buildCampaignRepresentativeBadges(product, { max: 2 })` |
| `src/components/products/ProductCampaignBadge.tsx` | 실제 스팬 렌더·톤/서피스 |

### `buildCampaignRepresentativeBadges` 등 — `productCampaignBadges.ts` 전체

```ts
/**
 * 상품 카드 **대표 배지** — PR3: `campaign_card_meta`(taxonomy CMS) 우선, 없으면 문자열 레거시.
 */

import type { Product } from "@/types/product";
import type { ProductCardBadge } from "@/components/products/ProductCard";

/** 레거시: 라벨만 있을 때 우선순위 (taxonomy 없을 때) */
const PRIORITY_RECOMMEND = 1;
const PRIORITY_POPULAR = 2;
const PRIORITY_NEW = 3;
const PRIORITY_OTHER_BASE = 100;

export function normalizeCampaignLabel(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function campaignKey(label: string): string {
  return normalizeCampaignLabel(label).toLowerCase();
}

/** @deprecated PR3 이후 taxonomy badge_priority 사용. 레거시 fallback 전용 */
export function getCampaignBadgePriority(label: string): number {
  const k = campaignKey(label);
  if (k === "추천") return PRIORITY_RECOMMEND;
  if (k === "인기") return PRIORITY_POPULAR;
  if (k === "신규") return PRIORITY_NEW;
  return PRIORITY_OTHER_BASE;
}

function collectCampaignLabels(product: Product): string[] {
  const raw = product.campaigns ?? product.campaigns_json ?? [];
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const n = normalizeCampaignLabel(item);
    if (!n) continue;
    const key = campaignKey(n);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function sortCampaignLabelsForDisplay(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const pa = getCampaignBadgePriority(a);
    const pb = getCampaignBadgePriority(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b, "ko");
  });
}

function legacyCampaignBadgeTypeForLabel(label: string): string {
  const k = campaignKey(label);
  if (k === "추천" || k === "인기" || k === "신규") return "accent";
  return "muted";
}

/** 레거시 단일 라벨 → ProductCardBadge */
export function buildCampaignBadge(label: string): ProductCardBadge {
  const normalized = normalizeCampaignLabel(label);
  const k = campaignKey(normalized);
  let campaignTone: "primary" | "highlight" | "neutral" = "neutral";
  if (k === "추천") campaignTone = "primary";
  else if (k === "인기") campaignTone = "highlight";
  else if (k === "신규") campaignTone = "neutral";
  return {
    type: legacyCampaignBadgeTypeForLabel(normalized),
    label: normalized,
    priority: 100 - getCampaignBadgePriority(normalized),
    isActive: true,
    campaignTone,
  };
}

function appendRecommendPopularFallback(product: Product, labels: string[]): string[] {
  const next = [...labels];
  const seen = new Set(next.map((l) => campaignKey(l)));

  if (product.is_recommend === true && !seen.has("추천")) {
    next.push("추천");
    seen.add("추천");
  }
  if (product.is_popular === true && !seen.has("인기")) {
    next.push("인기");
    seen.add("인기");
  }
  return sortCampaignLabelsForDisplay(next);
}

function buildBadgesFromCampaignCardMeta(product: Product, max: number): ProductCardBadge[] {
  const meta = product.campaign_card_meta;
  if (!meta?.length) return [];
  const visible = meta.filter((m) => m.badge_visible === true);
  visible.sort((a, b) => {
    if (a.badge_priority !== b.badge_priority) return a.badge_priority - b.badge_priority;
    return a.displayLabel.localeCompare(b.displayLabel, "ko");
  });
  return visible.slice(0, max).map((m) => ({
    type: m.badge_tone,
    label: m.displayLabel,
    priority: 1_000_000 - m.badge_priority,
    isActive: true,
    campaignTone: m.badge_tone,
  }));
}

export type BuildCampaignRepresentativeBadgesOptions = {
  /** 대표 배지 최대 개수. related/grid/home 2, list·모바일 리스트 1 권장 */
  max?: number;
};

const DEFAULT_CAMPAIGN_BADGE_MAX = 2;

/**
 * 카드 상단 대표 배지 (campaign 소스 단일 진입점).
 * - `campaign_card_meta`에 해석된 토큰이 있으면 CMS 규칙만 사용(전부 비노출이면 배지 없음).
 * - 해석된 메타가 없을 때만 campaigns 문자열 + 레거시 추천/인기/신규 + is_* fallback.
 */
export function buildCampaignRepresentativeBadges(
  product: Product,
  options?: BuildCampaignRepresentativeBadgesOptions,
): ProductCardBadge[] {
  const max = Math.max(1, Math.min(2, options?.max ?? DEFAULT_CAMPAIGN_BADGE_MAX));
  const meta = product.campaign_card_meta;
  const hasResolvedCampaignTokens = Array.isArray(meta) && meta.length > 0;
  const fromMeta = buildBadgesFromCampaignCardMeta(product, max);
  if (fromMeta.length > 0) {
    return fromMeta;
  }
  if (hasResolvedCampaignTokens) {
    return [];
  }

  let labels = sortCampaignLabelsForDisplay(collectCampaignLabels(product));

  if (labels.length === 0) {
    labels = appendRecommendPopularFallback(product, []);
  } else {
    labels = labels.slice(0, max);
  }

  if (labels.length === 0) {
    return [];
  }

  return labels.slice(0, max).map((label) => buildCampaignBadge(label));
}

export function getPrimaryRepresentativeCampaignLabel(product: Product): string | undefined {
  const b = buildCampaignRepresentativeBadges(product, { max: 2 })[0];
  const t = b?.label?.trim();
  return t || undefined;
}
```

### `productCampaignResolve.ts` (전체)

```ts
/**
 * PR3: 상품의 campaigns 토큰(이름 또는 taxonomy id) → 카드 배지용 메타 해석.
 */

import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { CampaignBadgeTone, ProductCampaignCardMeta } from "@/types/productCampaignCard";

export type CampaignTaxonomyIndex = {
  byId: Map<string, ProductTaxonomy>;
  byNameKey: Map<string, ProductTaxonomy>;
};

function normKey(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCampaignTokenUuid(token: string): boolean {
  return UUID_RE.test(token.trim());
}

function parseBadgeTone(raw: unknown): CampaignBadgeTone {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "primary" || s === "highlight" || s === "neutral") return s;
  return "neutral";
}

/** campaign taxonomy 목록으로 조회 인덱스 생성 */
export function buildCampaignTaxonomyIndex(taxonomies: ProductTaxonomy[]): CampaignTaxonomyIndex {
  const byId = new Map<string, ProductTaxonomy>();
  const byNameKey = new Map<string, ProductTaxonomy>();
  for (const t of taxonomies) {
    if (t.taxonomy_type !== "campaign") continue;
    if (t.id) byId.set(t.id.trim(), t);
    const nk = normKey(t.name ?? "");
    if (nk) byNameKey.set(nk, t);
  }
  return { byId, byNameKey };
}

function taxonomyToCardMeta(t: ProductTaxonomy): ProductCampaignCardMeta {
  const name = (t.name ?? "").trim() || "—";
  const display =
    (typeof t.display_label === "string" && t.display_label.trim() !== ""
      ? t.display_label.trim()
      : name) || name;
  const priority =
    typeof t.badge_priority === "number" && Number.isFinite(t.badge_priority)
      ? t.badge_priority
      : 100;
  const visible = t.badge_visible !== false;
  const tone = parseBadgeTone(t.badge_tone);
  const desc =
    typeof t.badge_description === "string" && t.badge_description.trim() !== ""
      ? t.badge_description.trim()
      : undefined;
  return {
    taxonomyId: t.id,
    name,
    displayLabel: display,
    badge_priority: priority,
    badge_visible: visible,
    badge_tone: tone,
    description: desc,
  };
}

/** 토큰이 taxonomy에 없을 때 (레거시 문자열) */
export function legacyCampaignTokenToMeta(token: string): ProductCampaignCardMeta {
  const name = token.replace(/\s+/g, " ").trim();
  const k = normKey(name);
  let priority = 100;
  let tone: CampaignBadgeTone = "neutral";
  if (k === "추천") {
    priority = 1;
    tone = "primary";
  } else if (k === "인기") {
    priority = 2;
    tone = "highlight";
  } else if (k === "신규") {
    priority = 3;
    tone = "neutral";
  }
  return {
    name,
    displayLabel: name,
    badge_priority: priority,
    badge_visible: true,
    badge_tone: tone,
    description: undefined,
  };
}

function resolveToken(token: string, index: CampaignTaxonomyIndex): ProductCampaignCardMeta {
  const t = token.trim();
  if (!t) return legacyCampaignTokenToMeta("");
  if (isCampaignTokenUuid(t)) {
    const row = index.byId.get(t);
    if (row) return taxonomyToCardMeta(row);
  }
  const byName = index.byNameKey.get(normKey(t));
  if (byName) return taxonomyToCardMeta(byName);
  return legacyCampaignTokenToMeta(t);
}

/**
 * 상품 campaigns 배열 순서 유지, 중복 제거(같은 taxonomy id 또는 같은 표시 라벨 키).
 */
export function resolveProductCampaignCardMeta(
  product: Product,
  index: CampaignTaxonomyIndex,
): ProductCampaignCardMeta[] {
  const raw = product.campaigns ?? product.campaigns_json ?? [];
  if (!Array.isArray(raw)) return [];
  const out: ProductCampaignCardMeta[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const meta = resolveToken(item, index);
    const dedupe =
      meta.taxonomyId?.trim() ||
      `name:${normKey(meta.displayLabel)}` ||
      `raw:${normKey(item)}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(meta);
  }
  return out;
}

export function hydrateProductsWithCampaignCardMeta(
  products: Product[],
  campaignTaxonomies: ProductTaxonomy[],
): Product[] {
  const index = buildCampaignTaxonomyIndex(campaignTaxonomies);
  return products.map((p) => ({
    ...p,
    campaign_card_meta: resolveProductCampaignCardMeta(p, index),
  }));
}

export function hydrateProductWithCampaignCardMeta(
  product: Product,
  campaignTaxonomies: ProductTaxonomy[],
): Product {
  return hydrateProductsWithCampaignCardMeta([product], campaignTaxonomies)[0]!;
}
```

### `productCardProps.ts` — 배지·오버라이드 구간

```ts
// ... 상단 생략: buildProductCardInfoBadges 등

export type ProductToProductCardOverrides = Partial<
  Pick<
    ProductCardProps,
    | "layout"
    | "analyticsSource"
    | "analyticsSection"
    | "onClickDetail"
    | "onClickConsult"
    | "hrefDetail"
    | "oneLiner"
    | "ratingAvg"
    | "reviewCount"
    | "className"
    | "topPickLabel"
    | "experienceSummary"
    | "emphasizeFirstOnMobile"
    | "guideBridgeNarrowCopy"
    | "selectionHighlightLine"
    | "badges"
    | "infoBadges"
    | "campaignPitchLine"
    | "campaignPresentationKind"
  >
> & {
  /** 기본: list/mobile presentation이면 1, 그 외 2 */
  campaignBadgeMax?: number;
  /** 기본: list/mobile presentation이면 true(피치 생략) */
  omitCampaignPitch?: boolean;
};

export const CAMPAIGN_BADGE_MAX = {
  related: 2,
  grid: 2,
  home: 2,
  list: 1,
  listMobile: 1,
} as const;

function defaultCampaignBadgeMax(overrides: ProductToProductCardOverrides | undefined): number {
  if (overrides?.campaignBadgeMax != null) return Math.max(1, Math.min(2, overrides.campaignBadgeMax));
  const pk = overrides?.campaignPresentationKind;
  if (pk === "list" || pk === "mobile") return 1;
  return 2;
}

export function productToProductCardProps(
  product: Product,
  overrides?: ProductToProductCardOverrides,
): Omit<ProductCardProps, "onClickDetail" | "onClickConsult"> &
  Partial<ProductToProductCardOverrides> {
  // ...
  const maxBadges = defaultCampaignBadgeMax(overrides);
  const campaignBadges = buildCampaignRepresentativeBadges(product, { max: maxBadges });
  // ...
  return {
    // ...
    badges: campaignBadges,
    // ...
  };
}
```

### `ProductCampaignBadge.tsx` 전체

```tsx
"use client";

import { cn } from "@/lib/cn";
import type { CampaignBadgeTone } from "@/types/productCampaignCard";
import type { CampaignBadgeSurface, CampaignCardKind } from "@/lib/productCampaignPresentation";
import { getCampaignBadgeClassName } from "@/lib/productCampaignPresentation";

export type ProductCampaignBadgeProps = {
  label: string;
  /** true: 우선순위 1위 대표 배지 */
  isPrimary: boolean;
  /** 카드 유형별 크기·톤 */
  kind: CampaignCardKind;
  /** PR3: taxonomy CMS 톤. 없으면 라벨로 추론 */
  badgeTone?: CampaignBadgeTone | null;
  /** md: 오버레이·related, sm: 리스트/모바일 인라인 */
  size?: "sm" | "md";
  /** overlay: 이미지 위, inline: 제목 인접(본문 배경) */
  surface?: CampaignBadgeSurface;
  className?: string;
};

export function ProductCampaignBadge({
  label,
  isPrimary,
  kind,
  badgeTone,
  size = "md",
  surface = "overlay",
  className,
}: ProductCampaignBadgeProps) {
  const text = label.trim();
  if (!text) return null;

  return (
    <span
      title={text}
      className={cn(
        getCampaignBadgeClassName(text, {
          isPrimary,
          kind,
          badgeTone: badgeTone ?? undefined,
          size,
          surface,
        }),
        className,
      )}
    >
      {text}
    </span>
  );
}
```

### `ProductCard.tsx` — `ProductCampaignBadge` 렌더 발췌 (related / grid / list)

- related: 약 298–308행 — 이미지 위 `surface="overlay"` `size="md"`
- grid: 약 461–473행 — `surface="overlay"`
- list: 약 505–520행 — `surface="inline"` `size="sm"`

### 기타 호출처 (grep 기준)

- `src/components/products/ProductListCard.tsx`, `ProductListCardMobile.tsx`
- `src/components/products/HomeProductCard.tsx`
- `src/lib/admin/productPreview.ts`
- `src/components/products/landing/ProductLandingPage.tsx` — `ProductCard` `badges={item.badges ?? []}`

---

## 10) 관리자 / API — product-taxonomies·badge (3단계 확보용)

### DB 스키마 타입 — `src/types/productTaxonomy.ts` 발췌

```ts
  // --- PR3: campaign 카드 배지 CMS (product_taxonomies, taxonomy_type=campaign)
  /** 카드 배지 표시 라벨. 비어 있으면 name */
  display_label?: string | null;
  /** 배지 정렬. 낮을수록 우선. 기본 100 */
  badge_priority?: number | null;
  /** 카드 대표 배지 노출. 기본 true */
  badge_visible?: boolean | null;
  /** primary | highlight | neutral */
  badge_tone?: string | null;
  /** 카드 피치 1줄 */
  badge_description?: string | null;
```

### API `PATCH` — `badge_tone` 검증 (`src/app/api/admin/product-taxonomies/[id]/route.ts` 발췌)

```ts
const BADGE_TONE_VALUES = new Set(["primary", "highlight", "neutral"]);

function normalizeBadgeTone(raw: string | null | undefined): string | null {
  if (raw == null || raw.trim() === "") return null;
  const s = raw.trim().toLowerCase();
  return BADGE_TONE_VALUES.has(s) ? s : null;
}

// ... PATCH 본문 내:
  if (body.badge_tone !== undefined) {
    const t = normalizeBadgeTone(body.badge_tone ?? null);
    if (body.badge_tone != null && body.badge_tone.trim() !== "" && t === null) {
      return NextResponse.json(
        { message: "badge_tone은 primary, highlight, neutral 중 하나여야 합니다." },
        { status: 400 },
      );
    }
    updates.badge_tone = t;
  }
```

### API `POST` — 동일 필드 저장 (검증은 PATCH보다 느슨: `badge_tone` trim만)

`src/app/api/admin/product-taxonomies/route.ts` 내 `TaxonomyBody` 및 `insertPayload`:

```ts
  display_label?: string | null;
  badge_priority?: number | null;
  badge_visible?: boolean;
  badge_tone?: string | null;
  badge_description?: string | null;
// ...
  if (body.badge_tone !== undefined) insertPayload.badge_tone = body.badge_tone?.trim() || null;
```

### 클라이언트 — `src/components/admin/products/api/adminProductTaxonomy.client.ts`

- `CreateAdminTaxonomyPayload` / `UpdateAdminTaxonomyPayload`에 `display_label`, `badge_priority`, `badge_visible`, `badge_tone`, `badge_description` 포함.
- `createAdminProductTaxonomy` / `updateAdminProductTaxonomy` body 전달.

### 폼 — `src/components/admin/products/AdminProductTaxonomyView.tsx` (campaign 탭 편집)

- `startEdit`: `editDisplayLabel`, `editBadgeVisible`, `editBadgePriority`, `editBadgeTone`, `editBadgeDescription` 초기화 (약 547–559행).
- `submitEdit`: `activeTab === "campaign"`일 때 payload 구성 (약 604–630행).

---

## 부록: 랜딩·필터 진입 보조

`/products`의 `destination`/`city`/`theme` 쿼리 해석은 `src/lib/productFiltersLanding.ts` (이 문서에는 미포함 — 2단계에서 URL·초기필터 정책과 함께 검토).
