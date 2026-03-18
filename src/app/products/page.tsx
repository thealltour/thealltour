import SiteHeader from "@/components/SiteHeader";
import ProductsHero from "@/components/ProductsHero";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
import { getProducts } from "@/lib/products";
import { getProductTaxonomyOptions, getHubDestinations, getHubThemes, buildRegionTree, buildThemeTree, buildTaxonomyNameMap, getActiveProductLineTaxonomies } from "@/lib/productTaxonomies";
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
    collection?: string;
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
  const [taxonomyOptions, destinations, hubThemes, productLineTaxonomies] = await Promise.all([
    getProductTaxonomyOptions(products),
    getHubDestinations(),
    getHubThemes(),
    getActiveProductLineTaxonomies(),
  ]);
  const { categories, themes, productLines } = taxonomyOptions;
  const regionTree = buildRegionTree(destinations);
  const themeTree = buildThemeTree(hubThemes);
  const taxonomyNameMap = buildTaxonomyNameMap([
    ...destinations,
    ...hubThemes,
    ...productLineTaxonomies,
  ]);

  const landingResolved =
    hasLandingParams(query) ? await resolveLandingParams(query) : null;
  const initialFiltersFromServer = landingResolved?.initialFilters ?? null;
  const initialKeywordFromLanding = landingResolved?.initialKeyword ?? "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] text-[var(--text-primary)]">
      <SiteHeader activeTab="products" searchQuery={searchKeyword} golfPresetActive={golfPresetActive} />

      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-6">
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
              initialFiltersFromServer={initialFiltersFromServer}
              regionTaxonomies={destinations}
              themeTaxonomies={hubThemes}
            />
          )}
        </PageContainer>
      </main>
    </div>
  );
}
