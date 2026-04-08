import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { LandingDetailHero } from "@/components/landing/LandingDetailHero";
import { LandingSubCardsSection } from "@/components/landing/LandingSubCardsSection";
import { HubFilterSidebar } from "@/components/hub/HubFilterSidebar";
import CuratedBlock from "@/components/home/CuratedBlock";
import { StickySectionNav } from "@/components/navigation/StickySectionNav";
import { AllProductsBrowseCtaSection } from "@/components/landing/AllProductsBrowseCtaSection";
import { GuideCardGrid } from "@/components/guides/GuideCardGrid";
import { ReviewHighlightCard } from "@/components/home/ReviewHighlightCard";
import {
  getThemeBySlugForPublicLanding,
  getHubThemes,
  parseThemeTokens,
} from "@/lib/productTaxonomies";
import { getProducts } from "@/lib/products";
import { loadProductsListingContextForThemeDetail } from "@/lib/products/loadProductsListingContext";
import { getLandingSubnodes } from "@/lib/landingSubnodes";
import { getThemeLandingHref } from "@/lib/hubLandingLinks";
import { BreadcrumbWrapper } from "@/components/navigation/BreadcrumbWrapper";
import {
  getTaxonomyMetadataFallback,
  getTaxonomyHeroImageFallback,
} from "@/lib/landingMetadata";
import { HubBrowseCard } from "@/components/landing/HubBrowseCard";
import { buildTaxonomyDetailNavSections } from "@/lib/landing/taxonomyDetailNavSections";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { Product } from "@/types/product";

const RELATED_PRODUCTS_LIMIT = 12;

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

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const theme = await getThemeBySlugForPublicLanding(slug);
  if (!theme) return { title: "Not Found" };
  const { title, description } = getTaxonomyMetadataFallback(theme);
  return {
    title: `${title} | 더올투어`,
    description:
      description ||
      `${title} 테마의 여행·골프·패키지 상품을 만나보세요.`,
  };
}

export default async function ThemeLandingPage({ params }: Props) {
  const { slug } = await params;
  const theme = await getThemeBySlugForPublicLanding(slug);
  if (!theme) notFound();

  const [products, subnodes, allThemes] = await Promise.all([
    getProducts(),
    getLandingSubnodes("theme", slug),
    getHubThemes(),
  ]);
  const {
    categories,
    themes: themeNames,
    productLines,
    regionTree,
    themeTree,
    themeGuides,
    reviewHighlights,
  } = await loadProductsListingContextForThemeDetail(products, allThemes, theme.id);

  const parentId = theme.id.trim();
  const childThemes = allThemes
    .filter((t) => (t.parent_id ?? "").trim() === parentId)
    .sort((a, b) => {
      const sa = a.sort_order ?? 9999;
      const sb = b.sort_order ?? 9999;
      if (sa !== sb) return sa - sb;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko");
    });
  const childFallbackImages = buildThemeFallbackImageMap(childThemes, products);

  const themeNameLower = theme.name.trim().toLowerCase();
  const related = products
    .filter((p) => {
      const tokens = parseThemeTokens(p.theme).map((t) =>
        t.trim().toLowerCase(),
      );
      return tokens.includes(themeNameLower);
    })
    .slice(0, RELATED_PRODUCTS_LIMIT);

  const heroTitle = theme.landing_title?.trim() || theme.name;
  const heroDescription =
    theme.landing_description?.trim() ||
    theme.card_description?.trim() ||
    `${theme.name} 테마의 여행·골프·패키지 상품을 소개합니다.`;
  const heroImage = getTaxonomyHeroImageFallback(theme);

  const hubSections = buildTaxonomyDetailNavSections({
    childSection:
      childThemes.length > 0
        ? { id: "child-themes", label: "세부 테마" }
        : undefined,
    hasFeaturedLinks: false,
    hasGuides: themeGuides.length > 0,
    hasRecommended: related.length > 0,
    hasRelatedTaxonomies: false,
    hasReviews: reviewHighlights.length > 0,
  });

  const allProductsHref = `/products?theme=${encodeURIComponent(theme.name)}`;

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-8">
          <BreadcrumbWrapper
            items={[
              { label: "홈", href: "/" },
              { label: "테마", href: "/themes" },
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
                themeOptions={themeNames}
                themeTree={themeTree}
                productLineOptions={productLines}
                initialFilters={{ theme: theme.name }}
              />
              <StickySectionNav variant="desktop" sections={hubSections} />
            </div>
            <div className="min-w-0 flex-1">
              <StickySectionNav variant="mobile" sections={hubSections} />
          {childThemes.length > 0 ? (
            <SectionBlock id="child-themes" surface="none" padding="md" className="scroll-mt-28">
              <SectionHeader
                title="세부 테마 선택"
                description="원하는 테마를 선택해 보세요."
                align="left"
              />
              <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {childThemes.map((t) => {
                  const nameKey = t.name.trim().toLowerCase();
                  const cardImageUrl =
                    t.card_image_url?.trim() ||
                    childFallbackImages.get(nameKey) ||
                    undefined;
                  return (
                    <li key={t.id}>
                      <HubBrowseCard
                        item={{ ...t, card_image_url: cardImageUrl ?? t.card_image_url }}
                        href={getThemeLandingHref(t)}
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
              contextTitle={theme.name}
              nodes={subnodes}
            />
          </div>

          {themeGuides.length > 0 ? (
            <SectionBlock id="guides" surface="none" padding="md" className="scroll-mt-28">
              <SectionHeader
                eyebrow="TRAVEL GUIDE"
                title={`${theme.name} 가이드`}
                description="이 테마와 관련된 가이드를 만나보세요."
                align="left"
              />
              <div className="mt-6">
                <GuideCardGrid guides={themeGuides} />
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
                title={`${theme.name} 대표 상품`}
                description={`${theme.name} 테마와 연결된 상품입니다.`}
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
