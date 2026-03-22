import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getRegionSeoData } from "@/lib/products/getRegionSeoData";
import { getSiteBaseUrl } from "@/lib/seo/getSiteSeoDefaults";
import {
  getTaxonomyNameBySlug,
  getHubDestinations,
  getHubThemes,
  getProductTaxonomyOptions,
  buildRegionTree,
  buildThemeTree,
  buildTaxonomyNameMap,
  getActiveProductLineTaxonomies,
  getSelfAndDescendantIdsAndNames,
} from "@/lib/productTaxonomies";
import { getProductLandingData } from "@/lib/productLanding";
import { getProducts } from "@/lib/products";
import ProductLandingPage from "@/components/products/landing/ProductLandingPage";
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
import SiteHeader from "@/components/SiteHeader";
import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

type RegionLandingProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: RegionLandingProps): Promise<Metadata> {
  const { slug } = await params;
  const trimmed = slug?.trim() ?? "";
  const siteUrl = getSiteBaseUrl();

  if (!trimmed) {
    return {
      title: "지역별 여행",
      description: "더올투어 지역별 맞춤 골프·테마 여행 상품을 확인해 보세요.",
      alternates: { canonical: `${siteUrl}/products` },
    };
  }

  const seo = await getRegionSeoData(trimmed);
  const path = `/products/region/${trimmed}`;
  const url = `${siteUrl}${path}`;

  if (!seo) {
    return {
      title: "지역별 여행",
      description: "더올투어 지역별 맞춤 여행 상품을 확인해 보세요.",
      alternates: { canonical: url },
    };
  }

  return {
    title: { absolute: seo.documentTitle },
    description: seo.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: "더올투어",
      title: seo.documentTitle,
      description: seo.metaDescription,
      images: [
        {
          url: `${path}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${seo.ogTitle} 지역 여행`,
        },
      ],
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: seo.documentTitle,
      description: seo.metaDescription,
      images: [`${path}/twitter-image`],
    },
  };
}

/** 카드 이미지 미설정 시 해당 지역 상품 대표 이미지로 채움. */
function buildDestinationFallbackImageMap(
  destinations: ProductTaxonomy[],
  products: Product[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of destinations) {
    const first = products.find(
      (p) =>
        p.image_url?.trim() &&
        (p.destination_id === d.id ||
          p.category?.trim().toLowerCase() === d.name.trim().toLowerCase()),
    );
    if (first?.image_url?.trim()) {
      map.set(d.id, first.image_url.trim());
      map.set(d.name.trim().toLowerCase(), first.image_url.trim());
    }
  }
  return map;
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
    let dataWithChildren = landingData;
    const [allDestinations, products, hubThemes, productLineTaxonomies] = await Promise.all([
      getHubDestinations(),
      getProducts(),
      getHubThemes(),
      getActiveProductLineTaxonomies(),
    ]);
    const taxonomyOptions = await getProductTaxonomyOptions(products);
    const { categories, themes, productLines } = taxonomyOptions;
    const regionTree = buildRegionTree(allDestinations);
    const themeTree = buildThemeTree(hubThemes);
    const taxonomyNameMap = buildTaxonomyNameMap([
      ...allDestinations,
      ...hubThemes,
      ...productLineTaxonomies,
    ]);

    const normalizedSlug = trimmedSlug.toLowerCase().replace(/\s+/g, "-");
    const parent = allDestinations.find(
      (d) =>
        (d.slug?.trim().toLowerCase().replace(/\s+/g, "-") === normalizedSlug) ||
        d.name?.trim() === landingData.taxonomyName,
    );
    if (parent) {
      const parentId = parent.id.trim();
      const childDestinations = allDestinations
        .filter((d) => (d.parent_id ?? "").trim() === parentId)
        .sort((a, b) => {
          const sa = a.sort_order ?? 9999;
          const sb = b.sort_order ?? 9999;
          if (sa !== sb) return sa - sb;
          return (a.name ?? "").localeCompare(b.name ?? "", "ko");
        });
      const fallbackMap = buildDestinationFallbackImageMap(childDestinations, products);
      const childDestinationsWithImages = childDestinations.map((d) => {
        const cardImageUrl =
          d.card_image_url?.trim() ||
          fallbackMap.get(d.id) ||
          fallbackMap.get(d.name.trim().toLowerCase()) ||
          undefined;
        return { ...d, card_image_url: cardImageUrl ?? d.card_image_url };
      });
      dataWithChildren = { ...landingData, childDestinations: childDestinationsWithImages };
    }

    const initialFiltersFromServer = {
      region: landingData.taxonomyName,
      theme: null,
      product_line: null,
      q: null,
      sort: "" as const,
      collection: null,
    };
    const initialRegionDescendants = getSelfAndDescendantIdsAndNames(
      allDestinations,
      landingData.taxonomyName,
    );

    return (
      <>
        <SiteHeader activeTab="products" />
        <ProductLandingPage data={dataWithChildren} />
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
              initialFiltersFromServer={initialFiltersFromServer}
              basePath={`/products/region/${trimmedSlug}`}
              filterContextLabel={`현재 '${landingData.taxonomyName}' 기준으로 상품을 보여주고 있습니다.`}
              initialRegionDescendants={initialRegionDescendants}
              cardLayout="related"
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
