import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getThemeSeoData } from "@/lib/products/getThemeSeoData";
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
  parseThemeTokens,
} from "@/lib/productTaxonomies";
import { getProductLandingData } from "@/lib/productLanding";
import { getProducts } from "@/lib/products";
import ProductLandingPage from "@/components/products/landing/ProductLandingPage";
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

type ThemeLandingProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ThemeLandingProps): Promise<Metadata> {
  const { slug } = await params;
  const trimmed = slug?.trim() ?? "";
  const siteUrl = getSiteBaseUrl();

  if (!trimmed) {
    return {
      title: "테마별 여행",
      description: "더올투어 테마별 맞춤 여행 상품을 확인해 보세요.",
      alternates: { canonical: `${siteUrl}/products` },
    };
  }

  const seo = await getThemeSeoData(trimmed);
  const path = `/products/theme/${trimmed}`;
  const url = `${siteUrl}${path}`;

  if (!seo) {
    return {
      title: "테마별 여행",
      description: "더올투어 테마별 맞춤 여행 상품을 확인해 보세요.",
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
          alt: `${seo.ogTitle} 테마 여행`,
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

/** 카드 이미지 미설정 시 해당 테마 상품 대표 이미지로 채움. */
function buildThemeFallbackImageMap(
  themes: ProductTaxonomy[],
  products: Product[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of themes) {
    const nameLower = t.name.trim().toLowerCase();
    if (map.has(nameLower)) continue;
    const first = products.find(
      (p) =>
        p.image_url?.trim() &&
        parseThemeTokens(p.theme).map((x) => x.trim().toLowerCase()).includes(nameLower),
    );
    if (first?.image_url?.trim()) map.set(nameLower, first.image_url.trim());
  }
  return map;
}

/**
 * 테마 랜딩: /products/theme/[slug]
 * 랜딩 데이터가 유효하면 새 랜딩 UI 렌더, 아니면 기존대로 /products?theme={name} redirect.
 */
export default async function ProductsThemeSlugPage({ params }: ThemeLandingProps) {
  const { slug } = await params;
  const trimmedSlug = slug?.trim();
  if (!trimmedSlug) {
    redirect("/products");
  }

  const landingData = await getProductLandingData({ type: "theme", slug: trimmedSlug });
  const name = await getTaxonomyNameBySlug("theme", trimmedSlug);

  if (landingData && landingData.taxonomyName && landingData.hero?.primaryCtaHref) {
    let dataWithChildren = landingData;
    const [allThemes, products, destinations, productLineTaxonomies] = await Promise.all([
      getHubThemes(),
      getProducts(),
      getHubDestinations(),
      getActiveProductLineTaxonomies(),
    ]);
    const taxonomyOptions = await getProductTaxonomyOptions(products);
    const { categories, themes, productLines } = taxonomyOptions;
    const regionTree = buildRegionTree(destinations);
    const themeTree = buildThemeTree(allThemes);
    const taxonomyNameMap = buildTaxonomyNameMap([
      ...destinations,
      ...allThemes,
      ...productLineTaxonomies,
    ]);

    const normalizedSlug = trimmedSlug.toLowerCase().replace(/\s+/g, "-");
    const parent = allThemes.find(
      (t) =>
        (t.slug?.trim().toLowerCase().replace(/\s+/g, "-") === normalizedSlug) ||
        t.name?.trim() === landingData.taxonomyName,
    );
    if (parent) {
      const parentId = parent.id.trim();
      const childThemes = allThemes
        .filter((t) => (t.parent_id ?? "").trim() === parentId)
        .sort((a, b) => {
          const sa = a.sort_order ?? 9999;
          const sb = b.sort_order ?? 9999;
          if (sa !== sb) return sa - sb;
          return (a.name ?? "").localeCompare(b.name ?? "", "ko");
        });
      const fallbackMap = buildThemeFallbackImageMap(childThemes, products);
      const childThemesWithImages = childThemes.map((t) => {
        const nameKey = t.name.trim().toLowerCase();
        const cardImageUrl =
          t.card_image_url?.trim() ||
          fallbackMap.get(nameKey) ||
          undefined;
        return { ...t, card_image_url: cardImageUrl ?? t.card_image_url };
      });
      dataWithChildren = { ...landingData, childThemes: childThemesWithImages };
    }

    const initialFiltersFromServer = {
      region: null,
      theme: landingData.taxonomyName,
      product_line: null,
      q: null,
      sort: "" as const,
      collection: null,
    };
    const initialThemeDescendantNames = getSelfAndDescendantIdsAndNames(
      allThemes,
      landingData.taxonomyName,
    ).names;

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
              basePath={`/products/theme/${trimmedSlug}`}
              filterContextLabel={`현재 '${landingData.taxonomyName}' 테마 기준 결과입니다.`}
              initialThemeDescendantNames={initialThemeDescendantNames}
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
  redirect(`/products?theme=${encodeURIComponent(name)}`);
}
