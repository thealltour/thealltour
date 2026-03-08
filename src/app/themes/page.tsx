import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { HubBrowseCard } from "@/components/landing/HubBrowseCard";
import { HubChipList } from "@/components/landing/HubChipList";
import CuratedBlock from "@/components/home/CuratedBlock";
import {
  getHubThemes,
  parseThemeTokens,
} from "@/lib/productTaxonomies";
import { getProducts } from "@/lib/products";
import { getThemeLandingHref } from "@/lib/hubLandingLinks";

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

  const hasThemes = themes.length > 0;

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

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="page-content flex w-full flex-col py-8 md:py-12">
        <PageContainer size="wide" className="flex flex-col gap-16 md:gap-20">
          <LandingHero
            title="테마별 여행"
            description="원하는 여행 스타일, 목적, 분위기 기준으로 탐색해 보세요. 테마를 선택하면 해당 테마의 상품을 바로 둘러보실 수 있습니다."
            ctaLabel="전체 상품 보기"
            ctaHref="/products"
          />

          {hasThemes ? (
            <>
              <SectionBlock surface="none" padding="md">
                <HubChipList items={themes} getHref={getThemeLandingHref} />
              </SectionBlock>
              <SectionBlock surface="none" padding="md">
                <SectionHeader
                  title="대표 테마"
                  description="원하는 테마를 선택해 보세요."
                  align="left"
                />
                <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {themes.map((t) => (
                    <li key={t.id}>
                      <HubBrowseCard
                        item={t}
                        href={getThemeLandingHref(t)}
                        showImage={true}
                      />
                    </li>
                  ))}
                </ul>
              </SectionBlock>

              {hasPreviews && (
                <section className="space-y-12">
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
                        />
                      ),
                  )}
                </section>
              )}

              <SectionBlock surface="muted" padding="lg">
                <SectionHeader
                  title="더 많은 상품 보기"
                  description="전체 상품 목록에서 지역·테마·정렬로 편하게 탐색할 수 있습니다."
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
            </>
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
