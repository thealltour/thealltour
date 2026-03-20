import { ShieldCheck, Users, Route, CheckCircle2 } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { getHomeCuratedData } from "@/lib/homeCurated";
import { getHomeBanners } from "@/lib/homeBanners";
import { getHeroContent, resolveHeroContent } from "@/lib/heroContent";
import { getHubDestinations, getHubThemes } from "@/lib/productTaxonomies";
import { getSiteSettings, parseHomeRegionCardIds, parseHomeThemeCardIds } from "@/lib/siteSettings";
import { getHomeGuidesWithTaxonomyNames } from "@/lib/guides";
import { getTopRatedPublishedReviews } from "@/lib/reviews";
import HeroQuickConsultButton from "@/components/HeroQuickConsultButton";
import HeroSection from "@/components/home/HeroSection";
import DestinationSection from "@/components/home/DestinationSection";
import ThemeSection from "@/components/home/ThemeSection";
import CuratedProductsSection from "@/components/home/CuratedProductsSection";
import { HomeGuideSection } from "@/components/home/HomeGuideSection";
import { HomeReviewSection } from "@/components/home/HomeReviewSection";

/**
 * 홈 페이지. 섹션 순서 고정: Hero → Destination → Theme → Curated Products.
 * 이후 Guide, Review, Trust, Contact.
 */
export default async function Home() {
  const [homeCurated, topBanners, heroContent, settings, destinations, themes, homeGuides, homeReviews] =
    await Promise.all([
      getHomeCuratedData(),
      getHomeBanners(),
      getHeroContent(),
      getSiteSettings(),
      getHubDestinations(),
      getHubThemes(),
      getHomeGuidesWithTaxonomyNames(4),
      getTopRatedPublishedReviews(4),
    ]);

  const curatedSettings = homeCurated.settings;
  const curatedSections = homeCurated.sections;
  const primaryBanner = topBanners[0] ?? null;
  const hero = resolveHeroContent(heroContent);

  const homeRegionCardIds = parseHomeRegionCardIds(settings);
  const destinationsForHome =
    homeRegionCardIds.length > 0
      ? homeRegionCardIds
          .map((id) => destinations.find((d) => d.id === id))
          .filter((d): d is NonNullable<typeof d> => Boolean(d))
          .slice(0, 8)
      : destinations.slice(0, 8);

  const homeThemeCardIds = parseHomeThemeCardIds(settings);
  const themesForHome =
    homeThemeCardIds.length > 0
      ? homeThemeCardIds
          .map((id) => themes.find((t) => t.id === id))
          .filter((t): t is NonNullable<typeof t> => Boolean(t))
          .slice(0, 8)
      : themes.slice(0, 8);

  return (
    <>
      <SiteHeader />

      <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
        <main className="flex w-full flex-col pt-1 pb-6 sm:py-10 md:py-14">
          <HeroSection primaryBanner={primaryBanner} hero={hero} />

          <PageContainer size="wide" className="flex flex-col gap-7 sm:gap-10 md:gap-20">
            <DestinationSection
              items={destinationsForHome}
              eyebrow={settings.home_region_section_eyebrow}
              title={settings.home_region_section_title}
              description={settings.home_region_section_description}
            />
            <ThemeSection
              items={themesForHome}
              eyebrow={settings.home_theme_section_eyebrow}
              title={settings.home_theme_section_title}
              description={settings.home_theme_section_description}
            />
            <CuratedProductsSection settings={curatedSettings} sections={curatedSections} />

            <HomeGuideSection guides={homeGuides} />
            <HomeReviewSection reviews={homeReviews} />

            <SectionBlock surface="none" padding="md">
              <div className="mb-8 space-y-3 text-center">
                <p className="inline-flex items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-1 section-label text-[var(--foreground)] md:type-small">
                  대형 여행사 공식 제휴 파트너
                </p>
                <p className="section-label text-[var(--text-muted)] md:type-small">
                  THEALL TOUR TRUST
                </p>
                <h3 className="heading-display section-title type-h3 md:text-[1.75rem] text-[var(--foreground)]">
                  안심하고 맡길 수 있는 여행 파트너
                </h3>
                <p className="mx-auto max-w-2xl type-small text-[var(--text-muted)]">
                  대형 여행사와의 공식 제휴와 검증된 일정 운영 경험을 바탕으로, 안정적인 예약과 운영을 약속드립니다.
                </p>
              </div>
              <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-7 lg:grid-cols-4">
                <div className="flex h-full flex-col rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-2xl sm:bg-[var(--surface)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] text-[var(--foreground)]">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-muted)] ring-1 ring-[var(--border)]">
                      <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />
                    </span>
                    <p className="text-sm font-semibold text-[var(--foreground)] type-small">대형 여행사 공식 제휴</p>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--text-muted)] type-caption">
                    국내 주요 파트너와 협력하여, 검증된 상품과 안정적인 예약 시스템을 기반으로 운영합니다.
                  </p>
                </div>
                <div className="flex h-full flex-col rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-2xl sm:bg-[var(--surface)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] text-[var(--foreground)]">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-muted)] ring-1 ring-[var(--border)]">
                      <Users className="h-5 w-5 text-[var(--primary)]" />
                    </span>
                    <p className="text-sm font-semibold text-[var(--foreground)] type-small">전문 상담사 1:1 배정</p>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--text-muted)] type-caption">
                    연령대·동행 구성·예산을 이해하는 담당자가 처음 상담부터 귀국까지 책임지고 함께하며, 필요한 내용을 차분하게 설명해 드립니다.
                  </p>
                </div>
                <div className="flex h-full flex-col rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-2xl sm:bg-[var(--surface)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] text-[var(--foreground)]">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-muted)] ring-1 ring-[var(--border)]">
                      <Route className="h-5 w-5 text-[var(--primary)]" />
                    </span>
                    <p className="text-sm font-semibold text-[var(--foreground)] type-small">단체·동호회 맞춤 설계</p>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--text-muted)] type-caption">
                    회사·동호회·가족 모임 등 인원과 목적에 맞춘 일정으로 이동 동선과 일정 피로도를 최소화한 코스를 제안합니다.
                  </p>
                </div>
                <div className="flex h-full flex-col rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-2xl sm:bg-[var(--surface)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] text-[var(--foreground)]">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-muted)] ring-1 ring-[var(--border)]">
                      <CheckCircle2 className="h-5 w-5 text-[var(--primary)]" />
                    </span>
                    <p className="text-sm font-semibold text-[var(--foreground)] type-small">안전 기준을 통과한 일정</p>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--text-muted)] type-caption">
                    현지 가이드·차량·숙소까지 사전 점검된 일정만 운영하며, 돌발 상황에도 대응 가능한 안전 프로세스를 갖추고 있습니다.
                  </p>
                </div>
              </div>
            </SectionBlock>

            <SectionBlock id="contact" surface="none" padding="md" className="md:px-12">
              <div className="grid items-start gap-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)]">
                <div className="space-y-4">
                  <p className="section-label text-[var(--text-muted)] md:type-small">THEALL TOUR CONTACT</p>
                  <h3 className="heading-display section-title type-h2 md:type-h2 text-[var(--foreground)]">
                    프리미엄 맞춤 상담으로 여정을 설계합니다
                  </h3>
                  <p className="type-small text-[var(--text-muted)] md:type-body">
                    간단한 내용을 남겨주시면 전담 상담사가 전화로 먼저 연락드려, 일정과 예산을 함께 정리해 드립니다.
                  </p>
                  <div className="mt-3 space-y-1.5 type-caption text-[var(--text-muted)] md:type-small">
                    <p>· 통화가 편하신 시간대를 메모로 남겨주시면 최대한 맞춰 연락드립니다.</p>
                    <p>· 상담 이후에도 일정 조정·추가 문의를 언제든지 편하게 요청하실 수 있습니다.</p>
                    <p>· 전화 연결이 어려운 경우, 문자/메신저로도 차분히 안내해 드립니다.</p>
                  </div>
                </div>
                <div className="rounded-none bg-transparent p-0 shadow-none ring-0 text-[var(--foreground)] sm:rounded-2xl sm:bg-[var(--surface)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] md:p-7">
                  <h4 className="mb-3 type-small font-semibold text-[var(--text-muted)] md:type-body">
                    한 번의 클릭으로 프리미엄 상담을 요청해 주세요.
                  </h4>
                  <p className="mb-4 type-caption text-[var(--text-muted)] md:type-small">
                    문의 양식을 길게 작성하지 않아도, 간단한 정보만 남기면 전담 상담사가 직접 연락드립니다.
                  </p>
                  <div className="rounded-none bg-transparent p-0 ring-0 sm:rounded-2xl sm:bg-[var(--surface-muted)] sm:p-4 sm:ring-1 sm:ring-[var(--border)] md:p-5">
                    <HeroQuickConsultButton />
                  </div>
                </div>
              </div>
            </SectionBlock>
          </PageContainer>
        </main>
      </div>
    </>
  );
}
