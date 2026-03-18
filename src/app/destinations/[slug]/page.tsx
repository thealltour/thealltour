import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { LandingDetailHero } from "@/components/landing/LandingDetailHero";
import { HubBrowseCard } from "@/components/landing/HubBrowseCard";
import { LandingSubCardsSection } from "@/components/landing/LandingSubCardsSection";
import { GuideCardGrid } from "@/components/guides/GuideCardGrid";
import { ReviewHighlightCard } from "@/components/home/ReviewHighlightCard";
import { HubFilterSidebar } from "@/components/hub/HubFilterSidebar";
import CuratedBlock from "@/components/home/CuratedBlock";
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
import {
  getDestinationBySlugForPublicLanding,
  getHubDestinations,
  getHubThemes,
  buildRegionTree,
  buildThemeTree,
  getProductTaxonomyOptions,
  buildTaxonomyNameMap,
  getActiveProductLineTaxonomies,
  getSelfAndDescendantIdsAndNames,
} from "@/lib/productTaxonomies";
import { getProducts } from "@/lib/products";
import { getGuidesByDestinationId } from "@/lib/guides";
import { getTopRatedPublishedReviews } from "@/lib/reviews";
import { getLandingSubnodes } from "@/lib/landingSubnodes";
import { getDestinationLandingHref } from "@/lib/hubLandingLinks";
import {
  getTaxonomyMetadataFallback,
  getTaxonomyHeroImageFallback,
} from "@/lib/landingMetadata";
import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

const RELATED_PRODUCTS_LIMIT = 12;

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

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const destination = await getDestinationBySlugForPublicLanding(slug);
  if (!destination) return { title: "Not Found" };
  const { title, description } = getTaxonomyMetadataFallback(destination);
  return {
    title: `${title} | 더올투어`,
    description: description || `${title} 지역 여행·골프·패키지 상품을 만나보세요.`,
  };
}

export default async function DestinationLandingPage({ params }: Props) {
  const { slug } = await params;
  const destination = await getDestinationBySlugForPublicLanding(slug);
  if (!destination) notFound();

  const [products, subnodes, allDestinations] = await Promise.all([
    getProducts(),
    getLandingSubnodes("destination", slug),
    getHubDestinations(),
  ]);
  const [taxonomyOptions, hubThemes, destinationGuides, reviewHighlights, productLineTaxonomies] =
    await Promise.all([
      getProductTaxonomyOptions(products),
      getHubThemes(),
      getGuidesByDestinationId(destination.id, 4),
      getTopRatedPublishedReviews(4),
      getActiveProductLineTaxonomies(),
    ]);
  const { categories, themes, productLines } = taxonomyOptions;
  const regionTree = buildRegionTree(allDestinations);
  const themeTree = buildThemeTree(hubThemes);
  const taxonomyNameMap = buildTaxonomyNameMap([
    ...allDestinations,
    ...hubThemes,
    ...productLineTaxonomies,
  ]);
  const initialFiltersFromServer = {
    region: destination.name,
    theme: null,
    product_line: null,
    q: null,
    sort: "" as const,
    collection: null,
  };
  const initialRegionDescendants = getSelfAndDescendantIdsAndNames(
    allDestinations,
    destination.name,
  );

  const parentId = destination.id.trim();
  const childDestinations = allDestinations
    .filter((d) => (d.parent_id ?? "").trim() === parentId)
    .sort((a, b) => {
      const sa = a.sort_order ?? 9999;
      const sb = b.sort_order ?? 9999;
      if (sa !== sb) return sa - sb;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko");
    });
  const childFallbackImages = buildDestinationFallbackImageMap(childDestinations, products);

  const nameLower = destination.name.trim().toLowerCase();
  const related = products
    .filter((p) => p.category?.trim().toLowerCase() === nameLower)
    .slice(0, RELATED_PRODUCTS_LIMIT);

  const heroTitle = destination.landing_title?.trim() || destination.name;
  const heroDescription =
    destination.landing_description?.trim() ||
    destination.card_description?.trim() ||
    `${destination.name} 지역의 여행·골프·패키지 상품을 소개합니다.`;
  const heroImage = getTaxonomyHeroImageFallback(destination);

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-8">
          <LandingDetailHero
            title={heroTitle}
            description={heroDescription}
            imageUrl={heroImage}
          />

          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            <div className="hidden w-72 shrink-0 lg:block">
              <HubFilterSidebar
                regionOptions={categories}
                regionTree={regionTree}
                themeOptions={themes}
                themeTree={themeTree}
                productLineOptions={productLines}
                initialFilters={{ region: destination.name }}
              />
            </div>
            <div className="min-w-0 flex-1">
          {childDestinations.length > 0 ? (
            <SectionBlock surface="none" padding="md">
              <SectionHeader
                title="도시·지역 선택"
                description="원하는 도시·지역을 선택해 보세요."
                align="left"
              />
              <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {childDestinations.map((d) => {
                  const cardImageUrl =
                    d.card_image_url?.trim() ||
                    childFallbackImages.get(d.id) ||
                    childFallbackImages.get(d.name.trim().toLowerCase()) ||
                    undefined;
                  return (
                    <li key={d.id}>
                      <HubBrowseCard
                        item={{ ...d, card_image_url: cardImageUrl ?? d.card_image_url }}
                        href={getDestinationLandingHref(d)}
                        showImage={true}
                      />
                    </li>
                  );
                })}
              </ul>
            </SectionBlock>
          ) : null}

          <LandingSubCardsSection
            contextTitle={destination.name}
            nodes={subnodes}
          />

          {destinationGuides.length > 0 ? (
            <SectionBlock surface="none" padding="md">
              <SectionHeader
                eyebrow="TRAVEL GUIDE"
                title={`${destination.name} 여행 가이드`}
                description="이 지역과 관련된 가이드를 만나보세요."
                align="left"
              />
              <div className="mt-6">
                <GuideCardGrid guides={destinationGuides} />
              </div>
              <div className="mt-4">
                <Link
                  href="/guides"
                  className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                >
                  가이드 더 보기
                </Link>
              </div>
            </SectionBlock>
          ) : null}

          {related.length > 0 ? (
            <CuratedBlock
              title={`${destination.name} 대표 상품`}
              description={`${destination.name} 지역과 연결된 상품입니다.`}
              products={related}
              surface="none"
            />
          ) : null}

          {reviewHighlights.length > 0 ? (
            <SectionBlock surface="none" padding="md">
              <SectionHeader
                eyebrow="TRAVEL REVIEWS"
                title="여행자들의 실제 후기"
                description="실제 여행객들의 생생한 후기를 만나보세요."
                align="left"
              />
              <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {reviewHighlights.map((review) => (
                  <li key={review.id}>
                    <ReviewHighlightCard review={review} />
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Link
                  href="/reviews"
                  className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                >
                  후기 전체 보기
                </Link>
              </div>
            </SectionBlock>
          ) : null}

            </div>
          </div>

          {/* 랜딩 직하단: 전체 상품 필터·리스트 (/products/region/[slug]와 동일 구조) */}
          <section
            className="min-h-screen border-t border-[var(--border)] bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] pt-10 mt-12 sm:mt-16"
            aria-labelledby="products-section-heading"
          >
            <div className="mx-auto w-full max-w-6xl px-3 py-8 sm:px-6 sm:py-10 md:px-10 md:py-14">
              <div className="flex flex-col gap-8">
                <h2
                  id="products-section-heading"
                  className="section-heading type-h2 text-[var(--foreground)] first:mt-0"
                >
                  {destination.name} 여행 상품 전체 보기
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
                  basePath={`/destinations/${slug}`}
                  filterContextLabel={`현재 '${destination.name}' 기준으로 상품을 보여주고 있습니다.`}
                  initialRegionDescendants={initialRegionDescendants}
                  cardLayout="related"
                />
              </div>
            </div>
          </section>
        </PageContainer>
      </main>
    </div>
  );
}
