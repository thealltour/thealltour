"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";
import { SlidersHorizontal, ArrowDownUp } from "lucide-react";
import ProductCatalogSection from "@/components/ProductCatalogSection";
import { ProductFilterSidebar } from "@/components/products/ProductFilterSidebar";
import { ProductFilterChips } from "@/components/products/ProductFilterChips";
import { MobileProductFilterDrawer } from "@/components/products/MobileProductFilterDrawer";
import { MobileProductSortSheet } from "@/components/products/MobileProductSortSheet";
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
import type { ProductTaxonomy } from "@/types/productTaxonomy";

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
  /** 랜딩(destination/city/theme slug) 진입 시 서버에서 해석한 초기 필터 */
  initialFiltersFromServer?: ProductFiltersState | null;
  /** 필터 변경 시 라우팅 기준 경로. 기본값 /products. 랜딩 하위에서 재사용 시 해당 경로 전달 */
  basePath?: string;
  /** 랜딩 페이지에서 칩 상단에 표시할 안내 문구 (예: "현재 '도쿄' 기준으로 상품을 보여주고 있습니다.") */
  filterContextLabel?: string | null;
  /** 랜딩 지역이 상위일 때 하위 지역 상품까지 포함하기 위한 id/name 집합. initialFiltersFromServer.region과 함께 사용 */
  initialRegionDescendants?: { ids: string[]; names: string[] } | null;
  /** 랜딩 테마가 상위일 때 하위 테마 상품까지 포함하기 위한 name 집합. initialFiltersFromServer.theme와 함께 사용 */
  initialThemeDescendantNames?: string[] | null;
  /** list: /products 본문용 비교 카드. related: 랜딩 하단용 간결 카드(이미지·가격 중심) */
  cardLayout?: "list" | "related";
  /** 지역 선택 시 하위 지역(도쿄 등) 포함용. /products에서 상위 선택 시 하위 상품까지 노출 */
  regionTaxonomies?: ProductTaxonomy[] | null;
  /** 테마 선택 시 하위 테마 포함용 */
  themeTaxonomies?: ProductTaxonomy[] | null;
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
  initialFiltersFromServer = null,
  basePath = "/products",
  filterContextLabel = null,
  initialRegionDescendants = null,
  initialThemeDescendantNames = null,
  cardLayout = "list",
  regionTaxonomies = null,
  themeTaxonomies = null,
}: ProductsPageContentProps) {
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
        {/* 모바일 전용: 필터/정렬 버튼 + 선택 칩 */}
        <div className="flex flex-wrap items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setFilterDrawerOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 type-small font-semibold text-[var(--foreground)] transition-colors active:bg-[var(--surface-muted)]"
            aria-label="필터 열기"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
            필터
          </button>
          <button
            type="button"
            onClick={() => setSortSheetOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 type-small font-semibold text-[var(--foreground)] transition-colors active:bg-[var(--surface-muted)]"
            aria-label="정렬 열기"
          >
            <ArrowDownUp className="h-4 w-4 shrink-0" aria-hidden />
            {sortLabel ?? "정렬"}
          </button>
        </div>

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
