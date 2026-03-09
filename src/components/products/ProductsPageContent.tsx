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

  const filteredProducts = useMemo(
    () => applyProductFilters(baseProducts, filters, taxonomyNameMap),
    [baseProducts, filters, taxonomyNameMap],
  );

  function handleFilterChange(next: Partial<ProductFiltersState>) {
    const nextParams = mergeFiltersIntoSearchParams(searchParams, {
      ...filters,
      ...next,
    });
    const qs = nextParams.toString();
    router.push(qs ? `/products?${qs}` : "/products");
  }

  const sortLabel = filters.sort
    ? SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? null
    : null;

  return (
    <div className="flex gap-8 items-start">
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

        <ProductFilterChips
          filters={filters}
          onRemoveRegion={() => handleFilterChange({ region: null })}
          onRemoveTheme={() => handleFilterChange({ theme: null })}
          onRemoveProductLine={() => handleFilterChange({ product_line: null })}
          onRemoveKeyword={() => handleFilterChange({ q: null })}
          onRemoveSort={() => handleFilterChange({ sort: "" })}
        />

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
          onResetFilters={() => handleFilterChange({ region: null, theme: null, product_line: null, q: null })}
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
        onReset={() => handleFilterChange({ region: null, theme: null, product_line: null })}
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
