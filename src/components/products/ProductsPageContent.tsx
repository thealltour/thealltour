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
  mergeFiltersIntoSearchParams,
  applyProductFilters,
  SORT_OPTIONS,
  type ProductFiltersState,
  type ProductSortId,
} from "@/lib/productFilters";
import { resolveProductsPageInitialFilters } from "@/lib/products/productsListingPolicy";
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
    () => resolveProductsPageInitialFilters(searchParams, initialFiltersFromServer),
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
    const merged: ProductFiltersState = { ...filters, ...next };
    const nextParams = mergeFiltersIntoSearchParams(searchParams, merged);
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
