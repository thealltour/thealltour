"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
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
import SearchPagination from "@/components/search/SearchPagination";
import RelatedTaxonomySection from "@/components/search/RelatedTaxonomySection";
import RelatedProductsSection from "@/components/search/RelatedProductsSection";
import {
  mergeFiltersIntoSearchParams,
  getCollectionLabel,
  PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE,
  SEARCH_SORT_OPTIONS,
  SORT_OPTIONS,
  type ProductCollectionId,
  type ProductFiltersState,
  type ProductSortId,
} from "@/lib/productFilters";
import { resolveProductsPageInitialFilters } from "@/lib/products/productsListingPolicy";
import {
  isGolfProductLineTaxonomy,
  parseGolfRegionPresetId,
  GOLF_REGION_PRESET_LABELS,
} from "@/lib/products/golfChannel";
import type { ProductListItem } from "@/lib/products/productListItem";
import type { RegionTreeNode } from "@/types/productTaxonomy";
import type { ProductsPageContentListingConfig } from "@/lib/products/productsPageContentConfig";
import type { GolfDepartureEvent } from "@/lib/products/golfDepartureCalendar";
import type { SearchProductsResult, SearchRecommendations } from "@/types/search";
import type { ProductListingPageResult } from "@/lib/products/productListingQuery";
import {
  resolveSearchModeSort,
  toSearchFilterStateForApi,
  buildProductsSearchModeHref,
  SEARCH_MODE_SORT_OPTIONS,
} from "@/lib/products/productsSearchMode";
import {
  buildProductsBrowsePageHref,
  readBrowseChannelParams,
} from "@/lib/products/buildProductsBrowseHref";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import { cn } from "@/lib/cn";
import { solidButtonShadowClasses } from "@/components/ui/Button";

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
  /**
   * Browse: current page items from getProductsPage (≤24). Listing cards only.
   * Search: unused for catalog (searchResult.items).
   */
  products: ProductListItem[];
  /** Browse server pagination result (authoritative totalCount / pages). */
  browsePage?: ProductListingPageResult | null;
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
  /** Server-built filtered Golf calendar universe (not page-24 listing). */
  golfCalendarEvents?: GolfDepartureEvent[];
  listing?: ProductsPageContentListingConfig;
  /** q 존재 시 Search Mode */
  mode?: "browse" | "search";
  searchResult?: SearchProductsResult | null;
  searchRecommendations?: SearchRecommendations | null;
};

export function ProductsPageContent({
  products,
  browsePage = null,
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
  golfCalendarEvents = [],
  listing,
  mode = "browse",
  searchResult = null,
  searchRecommendations = null,
}: ProductsPageContentProps) {
  const isSearchMode = mode === "search";
  const initialFiltersFromServer = listing?.initialFiltersFromServer ?? null;
  const basePath = listing?.basePath ?? "/products";
  const filterContextLabel = listing?.filterContextLabel ?? null;
  const cardLayout = listing?.cardLayout ?? "list";
  const mobileListToolbarBelowBackHeader = listing?.mobileListToolbarBelowBackHeader ?? false;
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

  /** Browse: server already filtered/sorted — no client applyProductFilters / promotion-first */
  const browseProducts = useMemo(() => {
    if (isSearchMode) return [];
    return browsePage?.items ?? products;
  }, [isSearchMode, browsePage?.items, products]);

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

  const calendarEvents =
    golfChannelPreset && !isSearchMode ? golfCalendarEvents : [];

  function handleFilterChange(next: Partial<ProductFiltersState>) {
    const merged: ProductFiltersState = { ...displayFilters, ...next };
    if (isSearchMode) {
      merged.collection = null;
      if (next.sort !== undefined) {
        merged.sort = resolveSearchModeSort(next.sort);
      }
    }
    const nextParams = mergeFiltersIntoSearchParams(searchParams, merged);
    // Browse + Search: filter/sort change → page 1
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

  const browseTotalCount = browsePage?.totalCount ?? 0;
  const browseTotalPages = browsePage?.totalPages ?? 0;
  const browseCurrentPage = browsePage?.page ?? 1;
  const browseOutOfRange =
    !isSearchMode && browseTotalCount > 0 && browseProducts.length === 0;

  const channelParams = readBrowseChannelParams(searchParams);
  const buildBrowseHref = (page: number) =>
    buildProductsBrowsePageHref(
      {
        region: displayFilters.region,
        theme: displayFilters.theme,
        product_line: displayFilters.product_line,
        sort: displayFilters.sort,
        collection: displayFilters.collection,
        tourType: channelParams.tourType,
        golfRegion: channelParams.golfRegion,
      },
      page,
      basePath,
    );

  const searchEmptyCurrent = {
    q: displayFilters.q ?? undefined,
    destination: displayFilters.region ?? undefined,
    theme: displayFilters.theme ?? undefined,
    product_line: displayFilters.product_line ?? undefined,
    sort: resolveSearchModeSort(displayFilters.sort) as
      | "relevance"
      | "latest"
      | "price_asc"
      | "price_desc",
  };

  return (
    <div className="flex w-full max-w-full flex-col gap-6">
      {golfChannelPreset && !isSearchMode ? (
        <GolfDepartureCalendarSection
          events={calendarEvents}
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

      {!isSearchMode && browseOutOfRange ? (
        <p className="type-small text-[var(--text-muted)]" role="status">
          총 {browseTotalCount}개 상품 · {browseCurrentPage}/{browseTotalPages}페이지
        </p>
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

          {!isSearchMode && browseOutOfRange ? (
            <div className="rounded-2xl bg-[var(--surface)] p-8 type-small text-[var(--text-muted)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] sm:rounded-3xl">
              <p className="font-semibold text-[var(--text-primary)]">
                요청한 페이지에 표시할 상품이 없습니다.
              </p>
              <p className="mt-2 text-[var(--text-secondary)]">
                총 {browseTotalCount}개 상품 · {browseTotalPages}페이지 중 {browseCurrentPage}
                페이지입니다.
              </p>
              <div className="mt-4">
                <Link
                  href={buildBrowseHref(1)}
                  className={cn(
                    "inline-flex items-center rounded-lg bg-[var(--primary)] px-4 py-2 type-btn font-semibold text-[var(--on-primary)] transition hover:opacity-90",
                    solidButtonShadowClasses,
                  )}
                >
                  1페이지로 이동
                </Link>
              </div>
            </div>
          ) : null}

          {!isSearchMode && !browseOutOfRange ? (
            <ProductCatalogSection
              products={browseProducts}
              categories={regionOptions}
              themeChipOptions={themeOptions}
              listTotalCount={browseTotalCount}
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

          {!isSearchMode && browseTotalPages > 1 ? (
            <div className="pt-2 pb-1">
              <SearchPagination
                currentPage={browseCurrentPage}
                totalPages={browseTotalPages}
                query={{}}
                buildPageHref={buildBrowseHref}
                trackAnalytics={false}
                ariaLabel="상품 목록 페이지 이동"
              />
            </div>
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
