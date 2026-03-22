import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader, SECTION_HEADER_MORE_LINK_CLASS } from "@/components/layout/SectionHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { ExploreRailSection } from "@/components/explore/ExploreRailSection";
import { StickySectionNav } from "@/components/navigation/StickySectionNav";
import { HubFilterSidebar } from "@/components/hub/HubFilterSidebar";
import CuratedBlock from "@/components/home/CuratedBlock";
import {
  getHubThemes,
  parseThemeTokens,
  getHubDestinations,
  getProductTaxonomyOptions,
  buildRegionTree,
  buildThemeTree,
} from "@/lib/productTaxonomies";
import { getProducts } from "@/lib/products";
import { getHubHeroConfig } from "@/lib/landingMetadata";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { Product } from "@/types/product";

/** 카드 이미지 미설정 시 해당 테마 상품의 대표 이미지로 채움. name -> image_url */
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

export const metadata = {
  title: "테마별 여행 | 더올투어",
  description:
    "원하는 여행 스타일, 목적, 분위기 기준으로 상품을 탐색해 보세요. 더올투어가 준비한 테마별 여행·골프·패키지를 만나보실 수 있습니다.",
};

const PREVIEW_THEMES_COUNT = 4;
const PREVIEW_PRODUCTS_PER_THEME = 4;

export default async function ThemesHubPage() {
  const [themes, products] = await Promise.all([
    getHubThemes(),
    getProducts(),
  ]);
  const [taxonomyOptions, destinations] = await Promise.all([
    getProductTaxonomyOptions(products),
    getHubDestinations(),
  ]);
  const { categories, themes: themeNames, productLines } = taxonomyOptions;
  const regionTree = buildRegionTree(destinations);
  const themeTree = buildThemeTree(themes);

  const hasThemes = themes.length > 0;
  const themeFallbackImages = buildThemeFallbackImageMap(themes, products);

  const themePreviews = hasThemes
    ? themes.slice(0, PREVIEW_THEMES_COUNT).map((t) => {
        const tokens = [t.name.trim().toLowerCase()];
        const items = products.filter((p) => {
          const productThemes = parseThemeTokens(p.theme).map((x) =>
            x.trim().toLowerCase(),
          );
          return productThemes.some((pt) => tokens.includes(pt));
        });
        return { theme: t, products: items.slice(0, PREVIEW_PRODUCTS_PER_THEME) };
      })
    : [];
  const hasPreviews = themePreviews.some((p) => p.products.length > 0);

  const themeRailItems = themes.map((t) => {
    const nameKey = t.name.trim().toLowerCase();
    const cardImageUrl =
      t.card_image_url?.trim() || themeFallbackImages.get(nameKey) || undefined;
    return { ...t, card_image_url: cardImageUrl ?? t.card_image_url };
  });

  const hubSections = [
    { id: "themes", label: "테마 여행" },
    { id: "recommended-products", label: "추천 상품" },
    { id: "destinations", label: "지역별 여행" },
    { id: "all-products", label: "전체 상품 조회" },
  ];

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-8">
          <LandingHero {...getHubHeroConfig("themes")} className="mb-12" />

          {hasThemes ? (
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
              <div className="hidden w-72 shrink-0 lg:flex lg:flex-col lg:gap-6">
                <HubFilterSidebar
                  regionOptions={categories}
                  regionTree={regionTree}
                  themeOptions={themeNames}
                  themeTree={themeTree}
                  productLineOptions={productLines}
                />
                <StickySectionNav variant="desktop" sections={hubSections} />
              </div>
              <div className="min-w-0 flex-1">
                <StickySectionNav variant="mobile" sections={hubSections} />
                <section id="themes" aria-labelledby="themes-heading">
                  <ExploreRailSection
                    titleId="themes-heading"
                    title="대표 테마"
                    description="원하는 테마를 선택해 보세요."
                    action={
                      <Link href="#all-products" className={SECTION_HEADER_MORE_LINK_CLASS}>
                        전체 보기
                        <span aria-hidden>→</span>
                      </Link>
                    }
                    taxonomyType="theme"
                    layoutPreset="hub"
                    items={themeRailItems}
                    listAriaLabel="대표 테마"
                  />
                </section>

                {hasPreviews && (
                  <section id="recommended-products" aria-labelledby="recommended-products-heading" className="mt-16">
                    <h2 id="recommended-products-heading" className="sr-only">
                      추천 상품
                    </h2>
                    <div className="space-y-12">
                      {themePreviews.map(
                        ({ theme, products: themeProducts }) =>
                          themeProducts.length > 0 && (
                            <CuratedBlock
                              key={theme.id}
                              title={theme.card_title?.trim() || theme.name}
                              description={
                                theme.card_description?.trim() ||
                                `${theme.name} 테마 상품을 소개합니다.`
                              }
                              products={themeProducts}
                              surface="none"
                              hubLandingLayout
                            />
                          ),
                      )}
                    </div>
                  </section>
                )}

                <section id="destinations" aria-labelledby="destinations-heading" className="mt-16">
                  <SectionBlock surface="none" padding="md">
                    <SectionHeader
                      titleId="destinations-heading"
                      title="지역별 여행"
                      description="지역별로 여행 상품을 둘러보세요."
                      align="left"
                    />
                    <div className="mt-6">
                      <Link
                        href="/destinations"
                        className="type-btn inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                      >
                        지역별로 보기
                      </Link>
                    </div>
                  </SectionBlock>
                </section>

                <section id="all-products" aria-labelledby="all-products-heading" className="mt-16">
                  <SectionBlock surface="muted" padding="lg">
                    <SectionHeader
                      titleId="all-products-heading"
                      title="전체 상품 조회"
                      description="전체 상품을 지역·테마 별로 정렬하여 탐색할 수 있습니다."
                      align="center"
                    />
                    <div className="mt-6 flex justify-center">
                      <Link
                        href="/products"
                        className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--primary)] px-5 py-2.5 font-semibold text-[var(--on-primary)] transition hover:opacity-90"
                      >
                        전체 상품 보기
                      </Link>
                    </div>
                  </SectionBlock>
                </section>
              </div>
            </div>
          ) : (
            <SectionBlock surface="muted" padding="lg">
              <SectionHeader
                title="현재 노출 가능한 테마가 없습니다"
                description="곧 테마별 상품을 준비하겠습니다. 아래에서 전체 상품을 둘러보시거나 맞춤 상담을 요청해 보세요."
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
          )}
        </PageContainer>
      </main>
    </div>
  );
}
