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
import { loadProductsListingContext } from "@/lib/products/loadProductsListingContext";
import {
  resolveLandingParams,
  hasLandingParams,
} from "@/lib/productFiltersLanding";
import { getCollectionCampaignNamesForListing } from "@/lib/products/getCollectionCampaignNamesForListing";
import {
  GOLF_PRESET_CATEGORIES,
  isGolfTourType,
} from "@/lib/products/golfChannel";

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
  }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const query = (await searchParams) ?? {};
  const searchKeyword = typeof query.q === "string" ? query.q.trim() : "";
  const tourType = typeof query.tourType === "string" ? query.tourType.trim() : "";
  const golfPresetActive = isGolfTourType(tourType);
  const presetCategories = golfPresetActive ? [...GOLF_PRESET_CATEGORIES] : undefined;
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

  const collectionCampaignNames = await getCollectionCampaignNamesForListing();

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
                collectionCampaignNames,
              }}
            />
          )}
        </PageContainer>
      </main>
    </div>
  );
}
