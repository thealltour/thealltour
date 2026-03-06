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

export type ProductsPageContentProps = {
  products: Product[];
  regionOptions: string[];
  themeOptions: string[];
  initialKeyword?: string;
  presetCategories?: string[];
  presetLabel?: string;
};

export function ProductsPageContent({
  products,
  regionOptions,
  themeOptions,
  initialKeyword = "",
  presetCategories,
  presetLabel,
}: ProductsPageContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  const filters = useMemo(
    () =>
      parseProductFiltersFromSearchParams(
        Object.fromEntries(searchParams.entries()),
      ),
    [searchParams],
  );

  const baseProducts = useMemo(() => {
    if (!presetCategories?.length) return products;
    const set = new Set(presetCategories.map((c) => c.trim()).filter(Boolean));
    return products.filter((p) => set.has(p.category ?? ""));
  }, [products, presetCategories]);

  const filteredProducts = useMemo(
    () => applyProductFilters(baseProducts, filters),
    [baseProducts, filters],
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
    <div className="flex gap-6">
      <ProductFilterSidebar
        regionOptions={regionOptions}
        themeOptions={themeOptions}
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
        />
      </div>

      <MobileProductFilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        regionOptions={regionOptions}
        themeOptions={themeOptions}
        filters={filters}
        onApply={(next) => handleFilterChange(next)}
        onReset={() => handleFilterChange({ region: null, theme: null })}
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
