import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTaxonomyNameBySlug } from "@/lib/productTaxonomies";
import { getProductLandingData } from "@/lib/productLanding";
import ProductLandingPage from "@/components/products/landing/ProductLandingPage";
import {
  buildProductsBreadcrumbItems,
  getProductsNavFallbackHref,
} from "@/components/navigation/breadcrumb-config";
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { loadProductRegionLandingMetadata } from "@/lib/landing/productSlugLandingMetadata";
import { loadProductsRegionLandingPageBundle } from "@/lib/landing/loadProductsSlugLandingPage";

type RegionLandingProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: RegionLandingProps): Promise<Metadata> {
  const { slug } = await params;
  const trimmed = slug?.trim() ?? "";
  return loadProductRegionLandingMetadata(trimmed);
}

/**
 * 지역 랜딩: /products/region/[slug]
 * 랜딩 데이터가 유효하면 새 랜딩 UI 렌더, 아니면 기존대로 /products?region={name} redirect.
 */
export default async function ProductsRegionSlugPage({ params }: RegionLandingProps) {
  const { slug } = await params;
  const trimmedSlug = slug?.trim();
  if (!trimmedSlug) {
    redirect("/products");
  }

  const landingData = await getProductLandingData({ type: "region", slug: trimmedSlug });
  const name = await getTaxonomyNameBySlug("category", trimmedSlug);

  if (landingData && landingData.taxonomyName && landingData.hero?.primaryCtaHref) {
    const { dataWithChildren, listing, initialFiltersFromServer, initialRegionDescendants } =
      await loadProductsRegionLandingPageBundle(trimmedSlug, landingData);
    const {
      products,
      categories,
      themes,
      productLines,
      regionTree,
      themeTree,
      taxonomyNameMap,
    } = listing;

    return (
      <>
        <SiteHeader activeTab="products" />
        <ProductLandingPage
          data={dataWithChildren}
          navigationContext={{
            items: buildProductsBreadcrumbItems("region", {
              currentLabel: landingData.taxonomyName,
            }),
            pageTitle: landingData.taxonomyName,
            fallbackHref: getProductsNavFallbackHref("region"),
          }}
        />
        <section
          className="min-h-screen border-t border-[var(--border)] bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] pt-10 mt-12 sm:mt-16"
          aria-labelledby="products-section-heading"
        >
          {/* 랜딩 상단과 동일한 가로 폭·패딩 체계(max-w-6xl, px-3 sm:px-6 md:px-10)로 정렬 */}
          <div className="mx-auto w-full max-w-6xl px-3 py-8 sm:px-6 sm:py-10 md:px-10 md:py-14">
            <div className="flex flex-col gap-8">
              <h2
                id="products-section-heading"
                className="section-heading type-h2 text-[var(--foreground)] first:mt-0"
              >
                {landingData.taxonomyName} 여행 상품 전체 보기
              </h2>
              <p className="section-description type-small text-[var(--text-muted)] -mt-4">
                조건을 변경하여 다양한 상품을 비교해보세요.
              </p>
              <ProductsPageContent
                products={products}
                taxonomyNameMap={taxonomyNameMap}
                regionOptions={categories}
                regionTree={regionTree}
                themeOptions={themes}
                themeTree={themeTree}
                productLineOptions={productLines}
                listing={{
                  initialFiltersFromServer,
                  basePath: `/products/region/${trimmedSlug}`,
                  filterContextLabel: `현재 '${landingData.taxonomyName}' 기준으로 상품을 보여주고 있습니다.`,
                  initialRegionDescendants,
                  cardLayout: "related",
                  mobileListToolbarBelowBackHeader: true,
                }}
              />
            </div>
          </div>
        </section>
      </>
    );
  }

  if (!name) {
    redirect("/products");
  }
  redirect(`/products?region=${encodeURIComponent(name)}`);
}
