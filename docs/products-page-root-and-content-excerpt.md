# /products 페이지 루트 + 콘텐츠 래퍼 발췌

## 1. 루트 페이지 — `src/app/products/page.tsx`

```tsx
import SiteHeader from "@/components/SiteHeader";
import ProductsHero from "@/components/ProductsHero";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
import { getProducts } from "@/lib/products";
import { getProductTaxonomyOptions, getHubDestinations, getHubThemes, buildRegionTree, buildThemeTree } from "@/lib/productTaxonomies";
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
  const products = await getProducts();
  const [taxonomyOptions, destinations, hubThemes] = await Promise.all([
    getProductTaxonomyOptions(products),
    getHubDestinations(),
    getHubThemes(),
  ]);
  const { categories, themes, productLines } = taxonomyOptions;
  const regionTree = buildRegionTree(destinations);
  const themeTree = buildThemeTree(hubThemes);

  const landingResolved =
    hasLandingParams(query) ? await resolveLandingParams(query) : null;
  const initialFiltersFromServer = landingResolved?.initialFilters ?? null;
  const initialKeywordFromLanding = landingResolved?.initialKeyword ?? "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] text-[var(--text-primary)]">
      <SiteHeader activeTab="products" searchQuery={searchKeyword} golfPresetActive={golfPresetActive} />

      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-8">
          <ProductsHero variant={golfPresetActive ? "golf" : "package"} />

          {products.length === 0 ? (
            <section className="rounded-2xl bg-[var(--surface)] p-8 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] type-small text-[var(--text-muted)] sm:rounded-3xl">
              현재 등록된 상품이 없습니다. 관리자 페이지에서 상품을 등록해 주세요.
            </section>
          ) : (
            <ProductsPageContent
              products={products}
              regionOptions={categories}
              regionTree={regionTree}
              themeOptions={themes}
              themeTree={themeTree}
              productLineOptions={productLines}
              initialKeyword={initialKeywordFromLanding || searchKeyword}
              presetCategories={presetCategories}
              presetLabel={golfPresetActive ? "골프/파크골프" : undefined}
              initialFiltersFromServer={initialFiltersFromServer}
            />
          )}
        </PageContainer>
      </main>
    </div>
  );
}
```

---

## 2. 콘텐츠 래퍼 — `src/components/products/ProductsPageContent.tsx`

```tsx
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
  regionOptions: string[];
  regionTree?: RegionTreeNode[];
  themeOptions: string[];
  themeTree?: RegionTreeNode[];
  productLineOptions: string[];
  initialKeyword?: string;
  presetCategories?: string[];
  presetLabel?: string;
  initialFiltersFromServer?: ProductFiltersState | null;
};

export function ProductsPageContent({
  products,
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
        <div className="flex flex-wrap items-center gap-2 lg:hidden">
          <button type="button" onClick={() => setFilterDrawerOpen(true)} ...>필터</button>
          <button type="button" onClick={() => setSortSheetOpen(true)} ...>{sortLabel ?? "정렬"}</button>
        </div>

        <ProductFilterChips filters={filters} onRemoveRegion={...} ... />

        <ProductCatalogSection
          products={filteredProducts}
          categories={regionOptions}
          initialKeyword={initialKeyword}
          presetCategories={presetCategories}
          presetLabel={presetLabel}
          initialRegion={filters.region}
          initialTheme={filters.theme}
          onCategoryChange={...}
          onThemeChange={...}
          onResetFilters={...}
        />
      </div>

      <MobileProductFilterDrawer ... />
      <MobileProductSortSheet ... />
    </div>
  );
}
```

---

## 구조 요약

| 계층 | 역할 |
|------|------|
| **page.tsx** | 루트: 배경/헤더, `main` → `PageContainer(size="wide")` → 히어로 + 빈 상태 또는 `ProductsPageContent` |
| **ProductsPageContent** | 콘텐츠 래퍼: `flex gap-8` 안에 좌측 `ProductFilterSidebar`, 우측 `min-w-0 flex-1`(모바일 필터/칩 + `ProductCatalogSection`), 모바일용 드로어/시트 |
