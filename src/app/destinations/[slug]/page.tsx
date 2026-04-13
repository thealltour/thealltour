import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import SiteHeader from "@/components/site-chrome/SiteHeader";
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
import { StickySectionNav } from "@/components/navigation/StickySectionNav";
import { AllProductsBrowseCtaSection } from "@/components/landing/AllProductsBrowseCtaSection";
import {
  getDestinationBySlugForPublicLanding,
  getHubDestinations,
} from "@/lib/productTaxonomies";
import { getProducts } from "@/lib/products";
import { getLandingSubnodes } from "@/lib/landingSubnodes";
import { buildDestinationFallbackImageMap } from "@/lib/landing/buildDestinationFallbackImageMap";
import { loadProductsListingContextForDestinationDetail } from "@/lib/products/loadProductsListingContext";
import { getDestinationLandingHref } from "@/lib/hubLandingLinks";
import { buildTaxonomyDetailNavSections } from "@/lib/landing/taxonomyDetailNavSections";
import { BreadcrumbWrapper } from "@/components/navigation/BreadcrumbWrapper";
import { getTaxonomyHeroImageFallback } from "@/lib/landingMetadata";
import { getDestinationSeoData } from "@/lib/destinations/getDestinationSeoData";
import {
  buildOgBrandFallbackMetadata,
  buildOgMetadataFromSeoData,
} from "@/lib/seo/buildOgPageMetadata";

const RELATED_PRODUCTS_LIMIT = 12;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const seo = await getDestinationSeoData(slug);
  if (!seo) {
    return buildOgBrandFallbackMetadata({
      canonicalPath: `/destinations/${slug}`,
      documentTitle: "여행지 | 더올투어",
      description: "요청하신 여행지 페이지를 찾을 수 없습니다.",
    });
  }
  return buildOgMetadataFromSeoData(seo);
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
  const {
    categories,
    themes,
    productLines,
    regionTree,
    themeTree,
    destinationGuides,
    reviewHighlights,
  } = await loadProductsListingContextForDestinationDetail(
    products,
    allDestinations,
    destination.id,
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

  const hubSections = buildTaxonomyDetailNavSections({
    childSection:
      childDestinations.length > 0
        ? { id: "child-destinations", label: "도시·지역" }
        : undefined,
    hasFeaturedLinks: false,
    hasGuides: destinationGuides.length > 0,
    hasRecommended: related.length > 0,
    hasRelatedTaxonomies: false,
    hasReviews: reviewHighlights.length > 0,
  });

  const allProductsHref = `/products?region=${encodeURIComponent(destination.name)}`;

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-8">
          <BreadcrumbWrapper
            items={[
              { label: "홈", href: "/" },
              { label: "여행지", href: "/destinations" },
              { label: heroTitle },
            ]}
          />
          <LandingDetailHero
            title={heroTitle}
            description={heroDescription}
            imageUrl={heroImage}
          />

          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            <div className="hidden w-72 shrink-0 lg:flex lg:flex-col lg:gap-6">
              <HubFilterSidebar
                regionOptions={categories}
                regionTree={regionTree}
                themeOptions={themes}
                themeTree={themeTree}
                productLineOptions={productLines}
                initialFilters={{ region: destination.name }}
              />
              <StickySectionNav variant="desktop" sections={hubSections} />
            </div>
            <div className="min-w-0 flex-1">
              <StickySectionNav variant="mobile" sections={hubSections} />
          {childDestinations.length > 0 ? (
            <SectionBlock id="child-destinations" surface="none" padding="md" className="scroll-mt-28">
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

          <div id="landing-subnodes" className="scroll-mt-28">
            <LandingSubCardsSection
              contextTitle={destination.name}
              nodes={subnodes}
            />
          </div>

          {destinationGuides.length > 0 ? (
            <SectionBlock id="guides" surface="none" padding="md" className="scroll-mt-28">
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
            <section id="recommended-products" className="scroll-mt-28">
              <CuratedBlock
                title={`${destination.name} 대표 상품`}
                description={`${destination.name} 지역과 연결된 상품입니다.`}
                products={related}
                surface="none"
                hubLandingLayout
              />
            </section>
          ) : null}

          {reviewHighlights.length > 0 ? (
            <SectionBlock id="reviews" surface="none" padding="md" className="scroll-mt-28">
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

              <AllProductsBrowseCtaSection href={allProductsHref} />
            </div>
          </div>
        </PageContainer>
      </main>
    </div>
  );
}
