import type { Metadata } from "next";
import {
  buildOgBrandFallbackMetadata,
  buildOgMetadataFromSeoData,
} from "@/lib/seo/buildOgPageMetadata";
import { getProductRegionOgPageSeo } from "@/lib/products/productRegionThemeOgPageSeo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTaxonomyNameBySlug } from "@/lib/productTaxonomies";
import { getProductLandingData } from "@/lib/productLanding";
import { buildProductsBreadcrumbItems } from "@/components/navigation/breadcrumb-config";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { loadProductsRegionLandingPageBundle } from "@/lib/landing/loadProductsSlugLandingPage";
import { loadProductsListingContextForDestinationDetail } from "@/lib/products/loadProductsListingContext";
import { getLandingSubnodes } from "@/lib/landingSubnodes";
import { getDestinationLandingHref } from "@/lib/hubLandingLinks";
import { BreadcrumbWrapper } from "@/components/navigation/BreadcrumbWrapper";
import { LandingDetailHero } from "@/components/landing/LandingDetailHero";
import { LandingSubCardsSection } from "@/components/landing/LandingSubCardsSection";
import { HubBrowseCard } from "@/components/landing/HubBrowseCard";
import { HubFilterSidebar } from "@/components/hub/HubFilterSidebar";
import CuratedBlock from "@/components/home/CuratedBlock";
import { GuideCardGrid } from "@/components/guides/GuideCardGrid";
import { ReviewHighlightCard } from "@/components/home/ReviewHighlightCard";
import { StickySectionNav } from "@/components/navigation/StickySectionNav";
import { AllProductsBrowseCtaSection } from "@/components/landing/AllProductsBrowseCtaSection";
import { buildTaxonomyDetailNavSections } from "@/lib/landing/taxonomyDetailNavSections";
import { CoupangTravelSection } from "@/components/affiliate/CoupangTravelSection";
import { shouldShowCoupangBannerForRegionSlug } from "@/lib/affiliate/isDomesticDestinationTaxonomy";

const RELATED_PRODUCTS_LIMIT = 12;

type RegionLandingProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: RegionLandingProps): Promise<Metadata> {
  const { slug } = await params;
  const trimmed = slug?.trim() ?? "";
  if (!trimmed) {
    return buildOgBrandFallbackMetadata({
      canonicalPath: "/products",
      documentTitle: "지역별 여행",
      description: "더올투어 지역별 맞춤 골프·테마 여행 상품을 확인해 보세요.",
      useAbsolutePageTitle: true,
    });
  }
  const seo = await getProductRegionOgPageSeo(trimmed);
  if (!seo) {
    return buildOgBrandFallbackMetadata({
      canonicalPath: "/products",
      documentTitle: "지역별 여행",
      description: "더올투어 지역별 맞춤 골프·테마 여행 상품을 확인해 보세요.",
      useAbsolutePageTitle: true,
    });
  }
  return buildOgMetadataFromSeoData(seo);
}

/**
 * 지역 랜딩: /products/region/[slug]
 * `/destinations/[slug]`와 동일 셸(좌측 필터·섹션 내비·CuratedBlock). 전체 목록은 CTA로 `/products?region=…` 이동.
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
    const [{ dataWithChildren, listing }, subnodes] = await Promise.all([
      loadProductsRegionLandingPageBundle(trimmedSlug, landingData),
      getLandingSubnodes("destination", trimmedSlug),
    ]);

    const {
      products,
      categories,
      themes,
      productLines,
      regionTree,
      themeTree,
    } = listing;

    const normalizedSlug = trimmedSlug.toLowerCase().replace(/\s+/g, "-");
    const parent = listing.hubDestinations.find(
      (d) =>
        d.slug?.trim().toLowerCase().replace(/\s+/g, "-") === normalizedSlug ||
        d.name?.trim() === landingData.taxonomyName,
    );
    const detailBatch = parent
      ? await loadProductsListingContextForDestinationDetail(
          listing.products,
          listing.hubDestinations,
          parent.id,
        )
      : null;

    const destinationGuides = detailBatch?.destinationGuides ?? [];
    const reviewHighlights = detailBatch?.reviewHighlights ?? [];

    const nameLower = landingData.taxonomyName.trim().toLowerCase();
    const related = products
      .filter((p) => p.category?.trim().toLowerCase() === nameLower)
      .slice(0, RELATED_PRODUCTS_LIMIT);

    const childList = dataWithChildren.childDestinations ?? [];
    const hubSections = buildTaxonomyDetailNavSections({
      childSection:
        childList.length > 0 ? { id: "child-destinations", label: "도시·지역" } : undefined,
      hasFeaturedLinks: dataWithChildren.featuredLinks.length > 0,
      hasGuides: destinationGuides.length > 0,
      hasRecommended: related.length > 0,
      hasRelatedTaxonomies: dataWithChildren.relatedTaxonomies.length > 0,
      hasReviews: reviewHighlights.length > 0,
    });

    const allProductsHref = `/products?region=${encodeURIComponent(landingData.taxonomyName)}`;
    const heroTitle = dataWithChildren.hero.title || landingData.taxonomyName;
    const heroDescription =
      dataWithChildren.hero.description ||
      `${landingData.taxonomyName} 지역의 여행·골프·패키지 상품을 소개합니다.`;
    const heroImage = dataWithChildren.hero.imageUrl?.trim() || null;

    const showCoupangBanner = shouldShowCoupangBannerForRegionSlug({
      slug: trimmedSlug,
      matchedDestination: parent ?? null,
      hubDestinations: listing.hubDestinations,
    });

    return (
      <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
        <SiteHeader activeTab="products" />

        <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
          <PageContainer size="wide" className="flex flex-col gap-8">
            <BreadcrumbWrapper
              items={buildProductsBreadcrumbItems("region", {
                currentLabel: landingData.taxonomyName,
              })}
            />
            <LandingDetailHero
              title={heroTitle}
              description={heroDescription}
              imageUrl={heroImage}
            />

            {showCoupangBanner ? (
              <CoupangTravelSection compact headingId="region-coupang-travel-heading" />
            ) : null}

            <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
              <div className="hidden w-72 shrink-0 lg:flex lg:flex-col lg:gap-6">
                <HubFilterSidebar
                  regionOptions={categories}
                  regionTree={regionTree}
                  themeOptions={themes}
                  themeTree={themeTree}
                  productLineOptions={productLines}
                  initialFilters={{ region: landingData.taxonomyName }}
                />
                <StickySectionNav variant="desktop" sections={hubSections} />
              </div>
              <div className="min-w-0 flex-1">
                <StickySectionNav variant="mobile" sections={hubSections} />

                {childList.length > 0 ? (
                  <SectionBlock
                    id="child-destinations"
                    surface="none"
                    padding="md"
                    className="scroll-mt-28"
                  >
                    <SectionHeader
                      title="도시·지역 선택"
                      description="원하는 도시·지역을 선택해 보세요."
                      align="left"
                    />
                    <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {childList.map((d) => (
                        <li key={d.id}>
                          <HubBrowseCard
                            item={d}
                            href={getDestinationLandingHref(d)}
                            showImage={true}
                          />
                        </li>
                      ))}
                    </ul>
                  </SectionBlock>
                ) : null}

                {dataWithChildren.featuredLinks.length > 0 ? (
                  <SectionBlock
                    id="featured-links"
                    surface="none"
                    padding="md"
                    className="scroll-mt-28"
                  >
                    <SectionHeader title="바로가기" align="left" />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {dataWithChildren.featuredLinks.slice(0, 8).map((link) => (
                        <Link
                          key={link.key}
                          href={link.href}
                          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </SectionBlock>
                ) : null}

                <div id="landing-subnodes" className="scroll-mt-28">
                  <LandingSubCardsSection
                    contextTitle={landingData.taxonomyName}
                    nodes={subnodes}
                  />
                </div>

                {destinationGuides.length > 0 ? (
                  <SectionBlock
                    id="guides"
                    surface="none"
                    padding="md"
                    className="scroll-mt-28"
                  >
                    <SectionHeader
                      eyebrow="TRAVEL GUIDE"
                      title={`${landingData.taxonomyName} 여행 가이드`}
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
                      title={`${landingData.taxonomyName} 대표 상품`}
                      description={`${landingData.taxonomyName} 지역과 연결된 상품입니다.`}
                      products={related}
                      surface="none"
                      hubLandingLayout
                      analyticsSource="landing"
                      analyticsLandingType="region"
                      taxonomySlug={trimmedSlug}
                    />
                  </section>
                ) : null}

                {dataWithChildren.relatedTaxonomies.length > 0 ? (
                  <SectionBlock
                    id="related-taxonomies"
                    surface="none"
                    padding="md"
                    className="scroll-mt-28"
                  >
                    <SectionHeader
                      title="함께 살펴볼 테마"
                      description={`${landingData.taxonomyName} 여행과 함께 많이 찾는 테마를 둘러보세요.`}
                      align="left"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {dataWithChildren.relatedTaxonomies.slice(0, 8).map((link) => (
                        <Link
                          key={link.key}
                          href={link.href}
                          className="inline-flex min-h-[44px] items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </SectionBlock>
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

  if (!name) {
    redirect("/products");
  }
  redirect(`/products?region=${encodeURIComponent(name)}`);
}
