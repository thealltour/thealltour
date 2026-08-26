"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import ProductCatalogSection from "@/components/product-detail/ProductCatalogSection";
import { ProductFilterSidebar } from "@/components/products/ProductFilterSidebar";
import { ProductFilterChips } from "@/components/products/ProductFilterChips";
import { MobileProductFilterDrawer } from "@/components/products/MobileProductFilterDrawer";
import { MobileProductSortSheet } from "@/components/products/MobileProductSortSheet";
import { ProductListToolbar } from "@/components/products/ProductListToolbar";
import { ProductsSearchModeResults } from "@/components/products/ProductsSearchModeResults";
import SearchEmpty from "@/components/search/SearchEmpty";
import RelatedTaxonomySection from "@/components/search/RelatedTaxonomySection";
import RelatedProductsSection from "@/components/search/RelatedProductsSection";
import {
  mergeFiltersIntoSearchParams,
  applyProductFilters,
  getCollectionLabel,
  PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE,
  SEARCH_SORT_OPTIONS,
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
import type { SearchProductsResult, SearchRecommendations } from "@/types/search";
import {
  resolveSearchModeSort,
  toSearchFilterStateForApi,
  buildProductsSearchModeHref,
  SEARCH_MODE_SORT_OPTIONS,
} from "@/lib/products/productsSearchMode";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

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
  taxonomyNameMap?: Record<string, string>;
  regionOptions: string[];
  regionTree?: RegionTreeNode[];
  themeOptions: string[];
  themeTree?: RegionTreeNode[];
  productLineOptions: string[];
  initialKeyword?: string;
  golfChannelPreset?: boolean;
  presetLabel?: string;
  golfCalendarMeta?: ProductsPageGolfCalendarMeta;
  listing?: ProductsPageContentListingConfig;
  /** q 존재 시 Search Mode */
  mode?: "browse" | "search";
  searchResult?: SearchProductsResult | null;
  searchRecommendations?: SearchRecommendations | null;
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
  mode = "browse",
  searchResult = null,
  searchRecommendations = null,
}: ProductsPageContentProps) {
  const isSearchMode = mode === "search";
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

  const displayFilters: ProductFiltersState = useMemo(() => {
    if (!isSearchMode) return filters;
    return {
      ...filters,
      sort: resolveSearchModeSort(filters.sort),
      collection: null,
    };
  }, [filters, isSearchMode]);

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
    if (isSearchMode) return undefined;
    const regionName = filters.region?.trim();
    const themeName = filters.theme?.trim();

    let regionDescendants: { ids: string[]; names: string[] } | undefined;
    let regionDescendantForName: string | undefined;
    let themeDescendantNames: string[] | undefined;
    let themeDescendantForName: string | undefined;

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
      ccn && ((ccn.recommend?.length ?? 0) > 0 || (ccn.popular?.length ?? 0) > 0);

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
    isSearchMode,
    filters.region,
    filters.theme,
    initialFiltersFromServer,
    initialRegionDescendants,
    initialThemeDescendantNames,
    regionTaxonomies,
    themeTaxonomies,
    listing?.collectionCampaignNames,
  ]);

  const filteredProducts = useMemo(() => {
    if (isSearchMode) return searchResult?.items ?? [];
    return sortProductsPromotionFirst(
      applyProductFilters(baseProducts, filters, taxonomyNameMap, filterApplyOptions),
    );
  }, [
    isSearchMode,
    searchResult?.items,
    baseProducts,
    filters,
    taxonomyNameMap,
    filterApplyOptions,
  ]);

  const golfCalendarEvents = useMemo(() => {
    if (!golfChannelPreset || isSearchMode) return [];
    return buildGolfDepartureEvents(
      filteredProducts,
      taxonomyNameMap ?? {},
      golfCalendarMeta?.promotionCampaignId ?? null,
    );
  }, [
    golfChannelPreset,
    isSearchMode,
    filteredProducts,
    taxonomyNameMap,
    golfCalendarMeta?.promotionCampaignId,
  ]);

  function handleFilterChange(next: Partial<ProductFiltersState>) {
    const merged: ProductFiltersState = { ...displayFilters, ...next };
    if (isSearchMode) {
      merged.collection = null;
      if (next.sort !== undefined) {
        merged.sort = resolveSearchModeSort(next.sort);
      }
    }
    const nextParams = mergeFiltersIntoSearchParams(searchParams, merged);
    // Search Mode pagination reset
    nextParams.delete("page");
    if (isSearchMode && merged.sort === "relevance") {
      nextParams.delete("sort");
    }
    const qs = nextParams.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);

    if (isSearchMode) {
      const changedKey = (Object.keys(next)[0] ?? "filter") as string;
      trackClientEvent(
        createAnalyticsPayload({
          eventName:
            changedKey === "sort"
              ? ANALYTICS_EVENTS.search_sort_change
              : ANALYTICS_EVENTS.search_filter_change,
          source: ANALYTICS_SOURCES.hero_search,
          query: merged.q ?? null,
          section: changedKey,
          label: String(next[changedKey as keyof ProductFiltersState] ?? ""),
          pagePath: typeof window !== "undefined" ? window.location.pathname : null,
          deviceType: inferDeviceType("mobile"),
        }),
      );
    }
  }

  const sortLabel = displayFilters.sort
    ? (isSearchMode ? SEARCH_SORT_OPTIONS : SORT_OPTIONS).find((o) => o.value === displayFilters.sort)
        ?.label ??
      SEARCH_SORT_OPTIONS.find((o) => o.value === displayFilters.sort)?.label ??
      null
    : null;

  const handleResetFilters = () => {
    if (isSearchMode) {
      handleFilterChange({
        region: null,
        theme: null,
        product_line: null,
        sort: "relevance",
        collection: null,
      });
      return;
    }
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

  const collectionLabel = getCollectionLabel(displayFilters.collection);
  const golfRegionLabel = golfRegionPreset ? GOLF_REGION_PRESET_LABELS[golfRegionPreset] : null;
  const searchTotalCount = searchResult?.totalCount ?? 0;
  const searchKeyword = displayFilters.q?.trim() ?? "";

  const searchEmptyCurrent = {
    q: displayFilters.q ?? undefined,
    destination: displayFilters.region ?? undefined,
    theme: displayFilters.theme ?? undefined,
    product_line: displayFilters.product_line ?? undefined,
    sort: resolveSearchModeSort(displayFilters.sort) as "relevance" | "latest" | "price_asc" | "price_desc",
  };

  return (
    <div className="flex w-full max-w-full flex-col gap-6">
      {golfChannelPreset && !isSearchMode ? (
        <GolfDepartureCalendarSection
          events={golfCalendarEvents}
          promotionLegendLabel={golfCalendarMeta?.promotionLegendLabel}
          eyebrow="출발일 한눈에"
          title="골프 출발 달력"
          description="현재 보고 있는 골프 상품의 출발 가능일을 확인하고 바로 상품으로 이동할 수 있습니다."
          className="!px-0"
        />
      ) : null}

      {isSearchMode && searchKeyword ? (
        <div className="space-y-1">
          <h2 className="type-h3 font-semibold text-[var(--foreground)]">
            &apos;{searchKeyword}&apos; 검색 결과
          </h2>
          <p className="type-small text-[var(--text-muted)]">총 {searchTotalCount}개 상품</p>
        </div>
      ) : null}

      <div className="flex w-full max-w-full items-start gap-8">
        <ProductFilterSidebar
          regionOptions={regionOptions}
          regionTree={regionTree}
          themeOptions={themeOptions}
          themeTree={themeTree}
          productLineOptions={effectiveProductLineOptions}
          filters={displayFilters}
          onFilterChange={handleFilterChange}
          searchMode={isSearchMode}
        />

        <div className="min-w-0 flex-1 space-y-4">
          <ProductListToolbar
            sortLabel={sortLabel}
            currentSort={displayFilters.sort}
            currentCollection={displayFilters.collection}
            onFilterClick={() => setFilterDrawerOpen(true)}
            onSortClick={() => setSortSheetOpen(true)}
            onSortChange={(sort) => handleFilterChange({ sort })}
            onCollectionChange={(collection: ProductCollectionId | null) =>
              handleFilterChange({ collection })
            }
            belowMobileBackHeader={mobileListToolbarBelowBackHeader}
            searchMode={isSearchMode}
            sortOptions={isSearchMode ? SEARCH_MODE_SORT_OPTIONS : undefined}
          />

          <div className="space-y-2">
            {golfRegionLabel && !isSearchMode && (
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
            {collectionLabel && !isSearchMode && (
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
            {filterContextLabel && !isSearchMode && (
              <p className="type-small text-[var(--text-muted)]" role="status">
                {filterContextLabel}
              </p>
            )}
            <ProductFilterChips
              filters={displayFilters}
              onRemoveRegion={() => handleFilterChange({ region: null })}
              onRemoveTheme={() => handleFilterChange({ theme: null })}
              onRemoveProductLine={() => handleFilterChange({ product_line: null })}
              onRemoveKeyword={() => handleFilterChange({ q: null })}
              onRemoveCollection={
                isSearchMode ? undefined : () => handleFilterChange({ collection: null })
              }
            />
          </div>

          {isSearchMode && searchTotalCount === 0 ? (
            <SearchEmpty
              keyword={searchKeyword || undefined}
              current={searchEmptyCurrent}
              resetHref={
                searchKeyword
                  ? buildProductsSearchModeHref(
                      { ...displayFilters, region: null, theme: null, product_line: null },
                      1,
                    )
                  : "/products"
              }
              onResetFilters={handleResetFilters}
            />
          ) : null}

          {isSearchMode && searchResult && searchTotalCount > 0 ? (
            <ProductsSearchModeResults
              key={`${searchKeyword}-${displayFilters.region}-${displayFilters.theme}-${displayFilters.product_line}-${displayFilters.sort}-${searchResult.page}`}
              initialItems={searchResult.items}
              initialPage={searchResult.page}
              totalPages={searchResult.totalPages}
              apiQuery={toSearchFilterStateForApi(displayFilters, searchResult.page)}
              filters={displayFilters}
            />
          ) : null}

          {!isSearchMode ? (
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
          ) : null}

          {isSearchMode && searchRecommendations ? (
            <>
              {searchRecommendations.destinations.length > 0 && (
                <RelatedTaxonomySection
                  items={searchRecommendations.destinations}
                  taxonomyType="destination"
                  query={searchKeyword}
                />
              )}
              {searchRecommendations.themes.length > 0 && (
                <RelatedTaxonomySection
                  items={searchRecommendations.themes}
                  taxonomyType="theme"
                  query={searchKeyword}
                />
              )}
              {searchRecommendations.products.length > 0 && (
                <RelatedProductsSection
                  title={searchTotalCount > 0 ? "이런 상품도 있어요" : "추천 여행 상품"}
                  products={searchRecommendations.products}
                />
              )}
            </>
          ) : null}
        </div>

        <MobileProductFilterDrawer
          isOpen={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
          regionOptions={regionOptions}
          regionTree={regionTree}
          themeOptions={themeOptions}
          themeTree={themeTree}
          productLineOptions={effectiveProductLineOptions}
          filters={displayFilters}
          onApply={(next) => handleFilterChange(next)}
          onReset={handleResetFilters}
        />

        <MobileProductSortSheet
          isOpen={sortSheetOpen}
          onClose={() => setSortSheetOpen(false)}
          currentSort={displayFilters.sort}
          onSelect={(sort: ProductSortId) => handleFilterChange({ sort })}
          options={isSearchMode ? SEARCH_MODE_SORT_OPTIONS : undefined}
        />
      </div>
    </div>
  );
}
