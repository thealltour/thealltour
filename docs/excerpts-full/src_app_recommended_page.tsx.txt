import Link from "next/link";
import { cn } from "@/lib/cn";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { HubFilterSidebar } from "@/components/hub/HubFilterSidebar";
import CuratedBlock from "@/components/home/CuratedBlock";
import { getHomeCuratedData } from "@/lib/homeCurated";
import { getRecommendedLandingHref } from "@/lib/hubLandingLinks";
import {
  getHubDestinations,
  getHubThemes,
  getProductTaxonomyOptions,
  buildRegionTree,
  buildThemeTree,
} from "@/lib/productTaxonomies";
import { getProducts } from "@/lib/products";

export const metadata = {
  title: "여행추천 | 더올투어",
  description:
    "더올투어가 선별한 추천 여행·골프·패키지 상품을 만나보세요. 큐레이션된 코스로 쉽게 탐색할 수 있습니다.",
};

export default async function RecommendedHubPage() {
  const [{ settings, sections }, products, destinations, hubThemes] = await Promise.all([
    getHomeCuratedData(),
    getProducts(),
    getHubDestinations(),
    getHubThemes(),
  ]);
  const taxonomyOptions = await getProductTaxonomyOptions(products);
  const { categories, themes, productLines } = taxonomyOptions;
  const regionTree = buildRegionTree(destinations);
  const themeTree = buildThemeTree(hubThemes);

  const isActive = settings?.is_active ?? false;
  const sectionList = sections ?? [];

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-8">
          <LandingHero
            title={settings?.section_title?.trim() || "지금 추천하는 여행"}
            description={
              settings?.section_description?.trim() ||
              "추천 시스템 기반으로 큐레이션된 여행·골프·패키지 상품을 소개합니다. 무엇을 갈지 아직 정하지 못했다면 여기서 시작해 보세요."
            }
            ctaLabel={settings?.catalog_button_label?.trim() || "전체 상품 보기"}
            ctaHref={settings?.catalog_button_href?.trim() || "/products"}
          />

          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            <div className="hidden w-72 shrink-0 lg:block">
              <HubFilterSidebar
                regionOptions={categories}
                regionTree={regionTree}
                themeOptions={themes}
                themeTree={themeTree}
                productLineOptions={productLines}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-12">
          {isActive && sectionList.length > 0 ? (
            <section className="space-y-12">
              {sectionList.map((sec) => {
                const sectionHref = getRecommendedLandingHref(sec);
                const hasDetailLanding = sectionHref !== "/recommended";
                return (
                  <div key={sec.id} className="space-y-3">
                    <CuratedBlock
                      title={sec.title}
                      description={sec.description || ""}
                      products={sec.products}
                      surface="none"
                    />
                    {hasDetailLanding && (
                      <div className="flex justify-end">
                        <Link
                          href={sectionHref}
                          className="section-label text-[var(--primary)] underline hover:no-underline"
                        >
                          이 섹션 상세 보기
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ) : (
            <SectionBlock surface="muted" padding="lg">
              <SectionHeader
                title="현재 준비된 추천 상품이 없습니다"
                description="곧 새로운 추천 코스를 준비하겠습니다. 아래에서 지역별·테마별로도 탐색할 수 있습니다."
                align="center"
              />
              <div className="mt-6 flex justify-center">
                <Link
                  href="/products"
                  className={cn(
                    "type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--primary)] px-5 py-2.5 font-semibold text-[var(--on-primary)] transition hover:opacity-90",
                    solidButtonShadowClasses,
                  )}
                >
                  전체 상품 보기
                </Link>
              </div>
            </SectionBlock>
          )}

          <SectionBlock surface="none" padding="md">
            <SectionHeader
              eyebrow="다른 방식으로 탐색"
              title="지역별·테마별로 찾기"
              description="원하는 지역이나 여행 스타일로도 상품을 둘러볼 수 있습니다."
              align="left"
            />
            <div className="mt-4 flex flex-wrap gap-4">
              <Link
                href="/destinations"
                className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
              >
                지역별 여행
              </Link>
              <Link
                href="/themes"
                className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
              >
                테마별 여행
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
