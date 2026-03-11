import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { LandingDetailHero } from "@/components/landing/LandingDetailHero";
import { LandingSubCardsSection } from "@/components/landing/LandingSubCardsSection";
import { HubFilterSidebar } from "@/components/hub/HubFilterSidebar";
import CuratedBlock from "@/components/home/CuratedBlock";
import { GuideCardGrid } from "@/components/guides/GuideCardGrid";
import { ReviewHighlightCard } from "@/components/home/ReviewHighlightCard";
import {
  getThemeBySlugForPublicLanding,
  getHubThemes,
  getHubDestinations,
  parseThemeTokens,
  getProductTaxonomyOptions,
  buildRegionTree,
  buildThemeTree,
} from "@/lib/productTaxonomies";
import { getProducts } from "@/lib/products";
import { getGuidesByThemeId } from "@/lib/guides";
import { getTopRatedPublishedReviews } from "@/lib/reviews";
import { getLandingSubnodes } from "@/lib/landingSubnodes";
import { getThemeLandingHref } from "@/lib/hubLandingLinks";
import {
  getTaxonomyMetadataFallback,
  getTaxonomyHeroImageFallback,
} from "@/lib/landingMetadata";
import { HubBrowseCard } from "@/components/landing/HubBrowseCard";
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
  const [taxonomyOptions, destinations, themeGuides, reviewHighlights] = await Promise.all([
    getProductTaxonomyOptions(products),
    getHubDestinations(),
    getGuidesByThemeId(theme.id, 4),
    getTopRatedPublishedReviews(4),
  ]);
  const { categories, themes: themeNames, productLines } = taxonomyOptions;
  const regionTree = buildRegionTree(destinations);
  const themeTree = buildThemeTree(allThemes);

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
                themeOptions={themeNames}
                themeTree={themeTree}
                productLineOptions={productLines}
                initialFilters={{ theme: theme.name }}
              />
            </div>
            <div className="min-w-0 flex-1">
          {childThemes.length > 0 ? (
            <SectionBlock surface="none" padding="md">
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

          <LandingSubCardsSection
            contextTitle={theme.name}
            nodes={subnodes}
          />

          {themeGuides.length > 0 ? (
            <SectionBlock surface="none" padding="md">
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
            <CuratedBlock
              title={`${theme.name} 대표 상품`}
              description={`${theme.name} 테마와 연결된 상품입니다.`}
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

          <SectionBlock surface="muted" padding="lg">
            <SectionHeader
              title="더 많은 상품 보기"
              description="전체 상품 목록에서 지역·테마·정렬로 탐색하거나 맞춤 상담을 요청해 보세요."
              align="center"
            />
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <Link
                href="/products"
                className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--primary)] px-5 py-2.5 font-semibold text-[var(--on-primary)] transition hover:opacity-90"
              >
                전체 상품 보기
              </Link>
              <Link
                href="/quote"
                className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
              >
                맞춤 상담 문의
              </Link>
            </div>
          </SectionBlock>
            </div>
          </div>
        </PageContainer>
      </main>
    </div>
  );
}
