"use client";

import dynamic from "next/dynamic";
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
  getCollectionLabel,
  PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE,
  SORT_OPTIONS,
  type ProductCollectionId,
  type ProductFiltersState,
  type ProductSortId,
} from "@/lib/productFilters";
import { resolveProductsPageInitialFilters } from "@/lib/products/productsListingPolicy";
import { sortProductsPromotionFirst } from "@/lib/products/productPromotionSort";
import {
  filterGolfChannelProducts,
  filterGolfProductsByRegionPreset,
  GOLF_REGION_PRESET_LABELS,
  isGolfProductLineTaxonomy,
  parseGolfRegionPresetId,
} from "@/lib/products/golfChannel";
import type { Product } from "@/types/product";
import type { RegionTreeNode } from "@/types/productTaxonomy";
import { getSelfAndDescendantIdsAndNames } from "@/lib/productTaxonomies";
import type { ProductsPageContentListingConfig } from "@/lib/products/productsPageContentConfig";
import { buildGolfDepartureEvents } from "@/lib/products/golfDepartureCalendar";

const GolfDepartureCalendarSection = dynamic(
  () => import("@/components/home/GolfDepartureCalendarSection"),
  {
    loading: () => (
      <div
        className="min-h-[22rem] w-full animate-pulse rounded-2xl bg-[var(--surface-muted)] ring-1 ring-[var(--border)]/60"
        aria-hidden
      />
    ),
  },
);

export type ProductsPageGolfCalendarMeta = {
  promotionCampaignId: string | null;
  promotionLegendLabel: string | null;
};

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
  golfChannelPreset?: boolean;
  presetLabel?: string;
  golfCalendarMeta?: ProductsPageGolfCalendarMeta;
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
  golfChannelPreset = false,
  presetLabel,
  golfCalendarMeta,
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

  const golfRegionPreset = useMemo(() => {
    if (!golfChannelPreset) return null;
    return parseGolfRegionPresetId(searchParams.get("golfRegion"));
  }, [golfChannelPreset, searchParams]);

  const baseProducts = useMemo(() => {
    if (!golfChannelPreset) return products;
    let list = filterGolfChannelProducts(products, taxonomyNameMap ?? {});
    if (golfRegionPreset && regionTaxonomies?.length) {
      list = filterGolfProductsByRegionPreset(
        list,
        golfRegionPreset,
        regionTaxonomies,
        taxonomyNameMap ?? {},
      );
    }
    return list;
  }, [products, golfChannelPreset, golfRegionPreset, regionTaxonomies, taxonomyNameMap]);

  const effectiveProductLineOptions = useMemo(() => {
    if (golfChannelPreset) {
      return productLineOptions.filter((name) => isGolfProductLineTaxonomy({ name }));
    }
    const options = [...productLineOptions];
    if (!options.includes(PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE)) {
      options.push(PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE);
    }
    return options;
  }, [productLineOptions, golfChannelPreset]);

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

    const ccn = listing?.collectionCampaignNames;
    const hasCollectionCampaigns =
      ccn &&
      ((ccn.recommend?.length ?? 0) > 0 || (ccn.popular?.length ?? 0) > 0);

    if (!regionDescendants && !themeDescendantNames && !hasCollectionCampaigns) return undefined;
    return {
      ...(regionDescendants && regionDescendantForName
        ? { regionDescendants, regionDescendantForName }
        : {}),
      ...(themeDescendantNames && themeDescendantForName
        ? { themeDescendantNames, themeDescendantForName }
        : {}),
      ...(hasCollectionCampaigns && ccn ? { collectionCampaignNames: ccn } : {}),
    };
  }, [
    filters.region,
    filters.theme,
    initialFiltersFromServer,
    initialRegionDescendants,
    initialThemeDescendantNames,
    regionTaxonomies,
    themeTaxonomies,
    listing?.collectionCampaignNames,
  ]);

  const filteredProducts = useMemo(
    () =>
      sortProductsPromotionFirst(
        applyProductFilters(baseProducts, filters, taxonomyNameMap, filterApplyOptions),
      ),
    [baseProducts, filters, taxonomyNameMap, filterApplyOptions],
  );

  const golfCalendarEvents = useMemo(() => {
    if (!golfChannelPreset) return [];
    return buildGolfDepartureEvents(
      filteredProducts,
      taxonomyNameMap ?? {},
      golfCalendarMeta?.promotionCampaignId ?? null,
    );
  }, [golfChannelPreset, filteredProducts, taxonomyNameMap, golfCalendarMeta?.promotionCampaignId]);

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
      handleFilterChange({
        region: null,
        theme: null,
        product_line: null,
        q: null,
        sort: "",
        collection: null,
      });
    }
  };

  const collectionLabel = getCollectionLabel(filters.collection);
  const golfRegionLabel = golfRegionPreset ? GOLF_REGION_PRESET_LABELS[golfRegionPreset] : null;

  return (
    <div className="flex w-full max-w-full flex-col gap-6">
      {golfChannelPreset ? (
        <GolfDepartureCalendarSection
          events={golfCalendarEvents}
          promotionLegendLabel={golfCalendarMeta?.promotionLegendLabel}
          eyebrow="출발일 한눈에"
          title="골프 출발 달력"
          description="현재 보고 있는 골프 상품의 출발 가능일을 확인하고 바로 상품으로 이동할 수 있습니다."
          className="!px-0"
        />
      ) : null}

      <div className="flex w-full max-w-full items-start gap-8">
      <ProductFilterSidebar
        regionOptions={regionOptions}
        regionTree={regionTree}
        themeOptions={themeOptions}
        themeTree={themeTree}
        productLineOptions={effectiveProductLineOptions}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      <div className="min-w-0 flex-1 space-y-4">
        <ProductListToolbar
          sortLabel={sortLabel}
          currentSort={filters.sort}
          currentCollection={filters.collection}
          onFilterClick={() => setFilterDrawerOpen(true)}
          onSortClick={() => setSortSheetOpen(true)}
          onSortChange={(sort) => handleFilterChange({ sort })}
          onCollectionChange={(collection: ProductCollectionId | null) =>
            handleFilterChange({ collection })
          }
          belowMobileBackHeader={mobileListToolbarBelowBackHeader}
        />

        <div className="space-y-2">
          {golfRegionLabel && (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--primary-soft)] bg-[var(--primary-soft)] px-3 py-2"
              role="status"
            >
              <p className="type-small text-[var(--primary)]">
                현재 <span className="font-semibold">{golfRegionLabel}</span> 지역 골프 상품만
                보여주고 있습니다.
              </p>
            </div>
          )}
          {collectionLabel && (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2"
              role="status"
            >
              <p className="type-small text-[var(--text-secondary)]">
                현재 <span className="font-semibold text-[var(--foreground)]">{collectionLabel}</span>
                {" "}내에서 상품을 보여주고 있습니다.
              </p>
              <button
                type="button"
                onClick={() => handleFilterChange({ collection: null })}
                className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 type-caption font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface)]/70"
              >
                전체 상품 보기
              </button>
            </div>
          )}
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
            onRemoveCollection={() => handleFilterChange({ collection: null })}
            onRemoveSort={() => handleFilterChange({ sort: "" })}
          />
        </div>

        <ProductCatalogSection
          products={filteredProducts}
          categories={regionOptions}
          initialKeyword={initialKeyword}
          golfChannelPreset={golfChannelPreset}
          presetLabel={presetLabel}
          initialRegion={filters.region}
          initialTheme={filters.theme}
          onCategoryChange={(region) => handleFilterChange({ region: region ?? null })}
          onThemeChange={(theme) => handleFilterChange({ theme: theme ?? null })}
          onResetFilters={handleResetFilters}
          initialCollection={filters.collection}
          onClearCollection={() => handleFilterChange({ collection: null })}
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
        productLineOptions={effectiveProductLineOptions}
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
    </div>
  );
}
