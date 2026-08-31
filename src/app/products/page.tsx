import type { Metadata } from "next";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { buildOgMetadataFromSeoData } from "@/lib/seo/buildOgPageMetadata";
import { getProductsIndexOgPageSeo } from "@/lib/seo/getProductsIndexOgPageSeo";
import ProductsHero from "@/components/product-detail/ProductsHero";
import { PageContainer } from "@/components/layout/PageContainer";
import { NavigationContextHeader } from "@/components/navigation/NavigationContextHeader";
import {
  buildProductsBreadcrumbItems,
  getProductsNavFallbackHref,
} from "@/components/navigation/breadcrumb-config";
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
import { loadProductsListingTaxonomyContext } from "@/lib/products/loadProductsListingContext";
import {
  resolveLandingParams,
  hasLandingParams,
} from "@/lib/productFiltersLanding";
import { getCollectionCampaignNamesForListing } from "@/lib/products/getCollectionCampaignNamesForListing";
import { isGolfTourType } from "@/lib/products/golfChannel";
import { getCampaignTaxonomiesForCard } from "@/lib/productTaxonomies";
import {
  resolvePromotionCampaignDisplayLabel,
  resolvePromotionCampaignId,
} from "@/lib/products/golfCalendarPromotion";
import { parseProductFiltersFromSearchParams } from "@/lib/productFilters";
import { shouldPreferServerInitialFilters } from "@/lib/products/productsListingPolicy";
import { searchProductsByParams } from "@/lib/search/searchProducts";
import { getSearchRecommendations } from "@/lib/search/getSearchRecommendations";
import {
  isProductsSearchMode,
  parseProductsSearchPage,
  resolveSearchModeSort,
  toSearchEngineParams,
} from "@/lib/products/productsSearchMode";
import { buildProductListingQueryParams } from "@/lib/products/buildProductListingQueryParams";
import {
  getProductsPage,
  PRODUCT_LIST_PAGE_SIZE,
  type ProductListingPageResult,
} from "@/lib/products/productListingQuery";
import { CoupangTravelSection } from "@/components/affiliate/CoupangTravelSection";

export async function generateMetadata(): Promise<Metadata> {
  return buildOgMetadataFromSeoData(getProductsIndexOgPageSeo());
}

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
    page?: string;
    golfRegion?: string;
  }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const query = (await searchParams) ?? {};
  const searchKeyword = typeof query.q === "string" ? query.q.trim() : "";
  const isSearchMode = isProductsSearchMode(searchKeyword);
  const tourType = typeof query.tourType === "string" ? query.tourType.trim() : "";
  const golfRegion = typeof query.golfRegion === "string" ? query.golfRegion.trim() : "";
  const golfPresetActive = isGolfTourType(tourType) && !isSearchMode;

  const listingCtx = await loadProductsListingTaxonomyContext();
  const {
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
    !isSearchMode && hasLandingParams(query) ? await resolveLandingParams(query) : null;
  const initialFiltersFromServer = landingResolved?.initialFilters ?? null;
  const initialKeywordFromLanding = landingResolved?.initialKeyword ?? "";

  const collectionCampaignNames = await getCollectionCampaignNamesForListing();

  let golfCalendarPromotionCampaignId: string | null = null;
  let golfCalendarPromotionLegendLabel: string | null = null;
  if (golfPresetActive) {
    const campaignTaxonomies = await getCampaignTaxonomiesForCard();
    golfCalendarPromotionCampaignId = resolvePromotionCampaignId(campaignTaxonomies);
    golfCalendarPromotionLegendLabel = resolvePromotionCampaignDisplayLabel(campaignTaxonomies);
  }

  const parsedFilters = parseProductFiltersFromSearchParams(
    query as Record<string, string | string[] | undefined>,
  );

  let searchResult = null;
  let searchRecommendations = null;
  let browsePage: ProductListingPageResult | null = null;

  if (isSearchMode) {
    const page = parseProductsSearchPage(query as Record<string, string | string[] | undefined>);
    const sort = resolveSearchModeSort(parsedFilters.sort);
    const engineParams = toSearchEngineParams({
      q: searchKeyword,
      region: parsedFilters.region,
      theme: parsedFilters.theme,
      product_line: parsedFilters.product_line,
      sort,
      page,
    });
    searchResult = await searchProductsByParams(engineParams);
    searchRecommendations = await getSearchRecommendations({
      q: searchKeyword,
      destination: engineParams.destination,
      theme: engineParams.theme,
      product_line: engineParams.product_line,
      products: searchResult.items,
    });
  } else {
    const page = parseProductsSearchPage(query as Record<string, string | string[] | undefined>);
    // Mirror ProductsPageContent / productsListingPolicy: landing snapshot only when preferred
    const preferServer = shouldPreferServerInitialFilters(
      {
        get: (name: string) => {
          const v = (query as Record<string, string | undefined>)[name];
          return typeof v === "string" ? v : null;
        },
        entries: () =>
          Object.entries(query).filter(
            (e): e is [string, string] => typeof e[1] === "string",
          ),
      },
      initialFiltersFromServer,
    );
    const effective = preferServer && initialFiltersFromServer
      ? initialFiltersFromServer
      : parsedFilters;

    const listingParams = buildProductListingQueryParams({
      filters: {
        region: effective.region,
        theme: effective.theme,
        product_line: effective.product_line,
        collection: effective.collection,
        sort: effective.sort,
        tourType: tourType || null,
        golfRegion: golfRegion || null,
        page,
        pageSize: PRODUCT_LIST_PAGE_SIZE,
      },
      taxonomy: {
        destinations: hubDestinations,
        themes: hubThemes,
        productLines: listingCtx.productLineTaxonomies,
        campaignNamesByCollection: collectionCampaignNames,
      },
    });

    browsePage = await getProductsPage(listingParams);
  }

  const showCatalogEmptyShell =
    !isSearchMode &&
    browsePage != null &&
    browsePage.totalCount === 0 &&
    !hasActiveBrowseFilters({
      region: parsedFilters.region ?? initialFiltersFromServer?.region,
      theme: parsedFilters.theme ?? initialFiltersFromServer?.theme,
      product_line: parsedFilters.product_line ?? initialFiltersFromServer?.product_line,
      collection: parsedFilters.collection ?? initialFiltersFromServer?.collection,
      tourType,
      golfRegion,
      sort: parsedFilters.sort ?? initialFiltersFromServer?.sort,
    });

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] text-[var(--text-primary)]">
      <SiteHeader activeTab="products" searchQuery={searchKeyword} golfPresetActive={golfPresetActive} />

      <main id="main-content" tabIndex={-1} className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-4 lg:gap-6">
          <NavigationContextHeader
            items={buildProductsBreadcrumbItems("index", {
              currentLabel: isSearchMode ? "검색" : "여행상품",
            })}
            pageTitle={isSearchMode ? "검색" : "여행상품"}
            fallbackHref={getProductsNavFallbackHref("index")}
            withMarginBottom={false}
          />
          {!isSearchMode ? (
            <>
              <ProductsHero variant={golfPresetActive ? "golf" : "package"} />
              <CoupangTravelSection compact />
            </>
          ) : null}

          {showCatalogEmptyShell ? (
            <section className="rounded-2xl bg-[var(--surface)] p-8 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] type-small text-[var(--text-muted)] sm:rounded-3xl">
              현재 등록된 상품이 없습니다. 관리자 페이지에서 상품을 등록해 주세요.
            </section>
          ) : (
            <ProductsPageContent
              mode={isSearchMode ? "search" : "browse"}
              searchResult={searchResult}
              searchRecommendations={searchRecommendations}
              browsePage={browsePage}
              products={browsePage?.items ?? []}
              taxonomyNameMap={taxonomyNameMap}
              regionOptions={categories}
              regionTree={regionTree}
              themeOptions={themes}
              themeTree={themeTree}
              productLineOptions={productLines}
              initialKeyword={isSearchMode ? "" : initialKeywordFromLanding || searchKeyword}
              golfChannelPreset={golfPresetActive}
              presetLabel={golfPresetActive ? "골프/파크골프" : undefined}
              golfCalendarMeta={
                golfPresetActive
                  ? {
                      promotionCampaignId: golfCalendarPromotionCampaignId,
                      promotionLegendLabel: golfCalendarPromotionLegendLabel,
                    }
                  : undefined
              }
              listing={{
                initialFiltersFromServer,
                regionTaxonomies: hubDestinations,
                themeTaxonomies: hubThemes,
                mobileListToolbarBelowBackHeader: true,
                collectionCampaignNames,
              }}
            />
          )}
        </PageContainer>
      </main>
    </div>
  );
}

function hasActiveBrowseFilters(input: {
  region?: string | null;
  theme?: string | null;
  product_line?: string | null;
  collection?: string | null;
  tourType?: string;
  golfRegion?: string;
  sort?: string | null;
}): boolean {
  return Boolean(
    input.region?.trim() ||
      input.theme?.trim() ||
      input.product_line?.trim() ||
      input.collection ||
      input.tourType?.trim() ||
      input.golfRegion?.trim() ||
      input.sort?.trim(),
  );
}
