# 모바일 홈 상단 UI 발췌 (전체 복사용)

**목적:** 홈 엔트리 → 히어로 → 검색 → 칩 → 바로 아래 섹션(지역/테마)까지 코드·데이터 흐름 파악.

**참고:** 프로젝트에 `useMediaQuery` 훅은 없음. 모바일/데스크탑 분기는 주로 Tailwind (`md:`, `sm:`, `lg:` 등)와 `hidden` / `md:block` / `md:hidden` 조합.

---

## 1) `src/app/page.tsx` (전체)

```tsx
import { ShieldCheck, Users, Route, CheckCircle2 } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { getHomeCuratedData } from "@/lib/homeCurated";
import { getHomeBanners } from "@/lib/homeBanners";
import { getHeroContent, resolveHeroContent } from "@/lib/heroContent";
import { getDestinationLandingHref, getThemeLandingHref } from "@/lib/hubLandingLinks";
import { getHubDestinations, getHubThemes } from "@/lib/productTaxonomies";
import { getSiteSettings, parseHomeRegionCardIds, parseHomeThemeCardIds } from "@/lib/siteSettings";
import { getHomeGuidesWithTaxonomyNames } from "@/lib/guides";
import { getTopRatedPublishedReviews } from "@/lib/reviews";
import HeroQuickConsultButton from "@/components/HeroQuickConsultButton";
import HeroSection from "@/components/home/HeroSection";
import type { HeroChipItem } from "@/components/home/HeroSection";
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

  const heroChipDestinations: HeroChipItem[] = destinationsForHome.slice(0, 6).map((d) => ({
    id: d.id,
    name: (d.card_title ?? d.name).trim() || d.name,
    href: getDestinationLandingHref(d),
  }));
  const heroChipThemes: HeroChipItem[] = themesForHome.slice(0, 6).map((t) => ({
    id: t.id,
    name: (t.card_title ?? t.name).trim() || t.name,
    href: getThemeLandingHref(t),
  }));

  return (
    <>
      <SiteHeader />

      <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
        <main className="flex w-full flex-col pt-4 pb-6 sm:py-10 md:py-14">
          <HeroSection
            primaryBanner={primaryBanner}
            hero={hero}
            heroChipDestinations={heroChipDestinations}
            heroChipThemes={heroChipThemes}
          />

          <PageContainer size="wide" className="flex flex-col gap-12 md:gap-20">
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
```

---

## 2) `src/components/home/HeroSection.tsx` (전체)

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { PageContainer } from "@/components/layout/PageContainer";
import { HeroRecommendedLinks } from "@/components/home/HeroRecommendedLinks";
import { HomeHeroSearch } from "@/components/home/HomeHeroSearch";
import type { HomeBanner } from "@/types/homeBanner";

export type HeroChipItem = { id: string; name: string; href: string };

export type HeroResolvedContent = {
  badge: string | null;
  main_copy_accent: string | null;
  main_copy_tail: string | null;
  sub_description: string | null;
  recommended_text: string | null;
  search_placeholder: string | null;
};

export type HeroSectionProps = {
  /** 메인 비주얼 배너 (데스크탑만 사용, 모바일 Hero에서는 미노출) */
  primaryBanner?: HomeBanner | null;
  /** 히어로 문구 (resolveHeroContent 결과) */
  hero: HeroResolvedContent;
  /** 모바일 Hero 검색 아래 인기 여행지 칩 (모바일만 노출) */
  heroChipDestinations?: HeroChipItem[];
  /** 모바일 Hero 검색 아래 추천 테마 칩 (모바일만 노출) */
  heroChipThemes?: HeroChipItem[];
};

/**
 * 홈 최상단 Hero 섹션.
 * 모바일: 이미지 없이 텍스트 + 검색 + 인기 여행지/추천 테마 칩.
 * 데스크탑: 기존 비주얼 배너 + 문구 + 검색 + 추천 링크 텍스트 유지.
 */
export default function HeroSection({
  primaryBanner = null,
  hero,
  heroChipDestinations = [],
  heroChipThemes = [],
}: HeroSectionProps) {
  const hasChips = heroChipDestinations.length > 0 || heroChipThemes.length > 0;

  return (
    <section className="relative bg-[var(--hero-bg)]">
      {/* 데스크탑 전용: 배경 이미지 + 오버레이 (모바일에서는 렌더하지 않음) */}
      {primaryBanner ? (
        <>
          <div className="pointer-events-none absolute inset-0 hidden md:block">
            <Image
              src={primaryBanner.image_url}
              alt={primaryBanner.title}
              fill
              sizes="100vw"
              priority
              fetchPriority="high"
              quality={82}
              className="object-cover object-[right_center]"
            />
            <div className="absolute inset-0 hero-scrim" />
            <div className="absolute inset-y-0 right-0 w-3/5 hero-overlay-warm mix-blend-soft-light" />
            <div className="absolute inset-y-0 left-1/2 w-[18%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[var(--hero-scrim-from)]/40 to-transparent backdrop-blur-[2px]" />
            <div className="absolute inset-0 hero-vignette" />
          </div>
          <div className="pointer-events-none absolute inset-0 hidden md:block hero-vignette-soft" />
        </>
      ) : null}

      <PageContainer size="wide">
        <div className="relative z-10 py-4 text-[var(--hero-text-primary)] sm:py-6 md:py-10">
          <div className="space-y-4 md:space-y-5">
            {/* 모바일: Hero 이미지 카드 제거 — 이미지 블록 없음 */}

            <div className="grid gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1.05fr)] md:items-center md:gap-6">
              <div className="space-y-3 md:space-y-4">
                <p className="inline-flex items-center gap-2 rounded-full bg-[var(--hero-badge-bg)] px-3 py-1 section-label text-[var(--hero-text-secondary)] ring-1 ring-[var(--hero-badge-border)] md:px-4 md:type-small">
                  {hero.badge ?? "THEALL TOUR"}
                </p>
                <h1 className="heading-display-hero type-h1 font-semibold leading-[1.15] md:text-[2.5rem]">
                  {hero.main_copy_accent ? (
                    <>
                      <span className="text-[var(--hero-accent)]">{hero.main_copy_accent}</span>
                      {hero.main_copy_tail}
                    </>
                  ) : (
                    hero.main_copy_tail?.trim() || "골프와 여행의 시작"
                  )}
                </h1>
                <p className="max-w-xl type-small font-semibold text-[var(--hero-text-secondary)] leading-snug md:type-body">
                  {hero.sub_description ?? ""}
                </p>
                <div className="w-full max-w-[720px] space-y-1">
                  <div className="pt-1 md:pt-3">
                    <HomeHeroSearch
                      placeholder={hero.search_placeholder ?? "지역, 테마, 상품명을 검색해보세요"}
                      hideRecentSearchesOnMobile
                      variant="hero-mobile"
                    />
                  </div>
                  {/* 모바일: 인기 여행지 / 추천 테마 칩 (검색 바로 아래) */}
                  {hasChips ? (
                    <div className="flex flex-col gap-3 pt-2 md:hidden">
                      {heroChipDestinations.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          <span className="section-label text-[11px] font-medium text-[var(--hero-text-secondary)]/90">
                            인기 여행지
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {heroChipDestinations.map((item) => (
                              <Link
                                key={item.id}
                                href={item.href}
                                className="inline-flex items-center rounded-full border border-[var(--hero-badge-border)] bg-[var(--hero-badge-bg)] px-3 py-1.5 text-xs font-medium text-[var(--hero-text-primary)] transition hover:bg-[var(--hero-badge-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:opacity-90"
                              >
                                {item.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {heroChipThemes.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          <span className="section-label text-[11px] font-medium text-[var(--hero-text-secondary)]/90">
                            추천 테마
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {heroChipThemes.map((item) => (
                              <Link
                                key={item.id}
                                href={item.href}
                                className="inline-flex items-center rounded-full border border-[var(--hero-badge-border)] bg-[var(--hero-badge-bg)] px-3 py-1.5 text-xs font-medium text-[var(--hero-text-primary)] transition hover:bg-[var(--hero-badge-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:opacity-90"
                              >
                                {item.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {/* 데스크탑: 기존 추천 링크 텍스트 */}
                  <p className="hidden pt-1 type-caption text-[var(--hero-text-secondary)]/80 md:block">
                    {hero.recommended_text ? (
                      <HeroRecommendedLinks text={hero.recommended_text} />
                    ) : (
                      <>
                        또는{" "}
                        <Link href="/destinations" className="underline hover:no-underline">
                          지역별 여행
                        </Link>
                        {" · "}
                        <Link href="/themes" className="underline hover:no-underline">
                          테마별 여행
                        </Link>
                        {" · "}
                        <Link href="/recommended" className="underline hover:no-underline">
                          여행추천
                        </Link>
                        {" 으로 탐색"}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="hidden min-h-[160px] md:block" />
            </div>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
```

---

## 3) `src/components/home/HomeHeroSearch.tsx` (전체)

**원문 전체는 이 문서 맨 아래 「부록 A」에 있습니다.** (419줄, 생략 없음)

**구조 요약:**

- 포커스 시 `HeaderSearchDropdown`(최근/추천), 입력 2글자 이상이면 `SearchSuggestionsDropdown`(자동완성, `/api/search/suggestions`).
- 추천 키워드: `/api/search/recommended`.
- `variant="hero-mobile"`: `rounded-2xl sm:rounded-[1.25rem] md:rounded-full`, `max-w-full md:max-w-[720px]`.
- `hideRecentSearchesOnMobile`: 검색창 아래 「최근 검색어」칩 행에 `hidden md:flex`.

---

## 4) `src/components/HeaderSearchDropdown.tsx` (전체)

```tsx
import type { MouseEvent } from "react";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

type RecommendedKeyword = {
  id: string;
  keyword: string;
};

type ProductSuggestionItem = {
  id: string;
  title: string;
  category?: string;
  theme?: string;
};

type HeaderSearchDropdownProps = {
  open: boolean;
  mode: "desktop" | "mobile";
  query: string;
  recentSearches: string[];
  recommended: RecommendedKeyword[];
  isLoadingRecommended: boolean;
  productSuggestions: ProductSuggestionItem[];
  onSelectKeyword: (value: string) => void;
};

export default function HeaderSearchDropdown({
  open,
  mode,
  query,
  recentSearches,
  recommended,
  isLoadingRecommended,
  productSuggestions,
  onSelectKeyword,
}: HeaderSearchDropdownProps) {
  const searchSource =
    mode === "desktop" ? ANALYTICS_SOURCES.header_search_desktop : ANALYTICS_SOURCES.header_search_mobile;

  function trackSearchClick(
    eventName: "search_recent_click" | "search_recommended_click" | "search_suggestion_click",
    value: string,
  ) {
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS[eventName],
        source: searchSource,
        query: query.trim() || null,
        label: value,
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType(mode),
      }),
    );
  }

  function handleClickRecent(event: MouseEvent<HTMLButtonElement>, value: string) {
    event.preventDefault();
    trackSearchClick("search_recent_click", value);
    onSelectKeyword(value);
  }

  function handleClickRecommended(event: MouseEvent<HTMLButtonElement>, value: string) {
    event.preventDefault();
    trackSearchClick("search_recommended_click", value);
    onSelectKeyword(value);
  }

  function handleClickSuggestion(event: MouseEvent<HTMLButtonElement>, value: string) {
    event.preventDefault();
    trackSearchClick("search_suggestion_click", value);
    onSelectKeyword(value);
  }

  if (
    !open ||
    (!recentSearches.length &&
      !recommended.length &&
      !productSuggestions.length &&
      !isLoadingRecommended)
  ) {
    return null;
  }

  return (
    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50">
      <div className="max-h-[min(70vh,400px)] overflow-y-auto overflow-x-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-[var(--shadow-modal)]">
        {/* 최근 검색어 섹션 */}
        {recentSearches.length > 0 ? (
          <section className="px-3 py-2.5">
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)]">
              <span>최근 검색어</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recentSearches.slice(0, 8).map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onMouseDown={(event) => handleClickRecent(event, keyword)}
                  className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-xs text-[var(--foreground)] transition hover:bg-[var(--surface)] hover:border-[var(--border-strong)]"
                >
                  {keyword}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* 추천 검색어 섹션 */}
        {isLoadingRecommended ? (
          <section className="border-t border-[var(--divider)] px-3 py-2.5">
            <p className="mb-1 text-[11px] font-semibold text-[var(--text-muted)]">
              추천 검색어
            </p>
            <div className="space-y-1.5">
              <div className="h-3 w-32 rounded bg-[var(--border)]/70 animate-pulse" />
              <div className="h-3 w-40 rounded bg-[var(--border)]/60 animate-pulse" />
            </div>
          </section>
        ) : recommended.length > 0 ? (
          <section className="border-t border-[var(--divider)] px-3 py-2.5">
            <p className="mb-1 text-[11px] font-semibold text-[var(--text-muted)]">
              추천 검색어
            </p>
            <div className="flex flex-wrap gap-1.5">
              {recommended.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(event) => handleClickRecommended(event, item.keyword)}
                  className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                >
                  {item.keyword}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* 상품 제안 섹션 */}
        {productSuggestions.length > 0 ? (
          <section className="border-t border-[var(--divider)]">
            <p className="px-3 pt-2 text-[11px] font-semibold text-[var(--text-muted)]">
              검색 제안
            </p>
            <ul className="max-h-64 overflow-y-auto px-1 pb-1.5 pt-1">
              {productSuggestions.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => handleClickSuggestion(event, item.title)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                  >
                    <span className="line-clamp-1 text-sm font-medium">
                      {item.title}
                    </span>
                    {(item.category || item.theme) && (
                      <span className="ml-3 shrink-0 text-[11px] text-[var(--text-muted)]">
                        {item.theme ? `${item.category} · ${item.theme}` : item.category}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* 검색어 없을 때 안내 */}
        {!recentSearches.length &&
          !recommended.length &&
          !productSuggestions.length &&
          !isLoadingRecommended && (
            <div className="px-3 py-2.5 text-[11px] text-[var(--text-muted)]">
              {query
                ? "입력하신 검색어와 관련된 추천 결과가 없습니다."
                : "최근 검색어나 추천 검색어가 준비되면 이곳에 표시됩니다."}
            </div>
          )}
      </div>
    </div>
  );
}
```

---

## 5) `src/components/search/SearchSuggestionsDropdown.tsx` (전체)

```tsx
"use client";

import type { SearchSuggestion } from "@/types/search";
import { cn } from "@/lib/cn";

const TYPE_LABELS: Record<SearchSuggestion["type"], string> = {
  destination: "지역",
  theme: "테마",
  product: "상품",
};

export type SearchSuggestionsDropdownProps = {
  open: boolean;
  suggestions: SearchSuggestion[];
  highlightedIndex: number;
  isLoading: boolean;
  query: string;
  onSelect: (suggestion: SearchSuggestion, index: number) => void;
  onMouseEnterItem: (index: number) => void;
};

export default function SearchSuggestionsDropdown({
  open,
  suggestions,
  highlightedIndex,
  isLoading,
  query,
  onSelect,
  onMouseEnterItem,
}: SearchSuggestionsDropdownProps) {
  if (!open) return null;

  if (isLoading) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 shadow-[var(--shadow-modal)]">
          <p className="text-xs text-[var(--text-muted)]">추천어를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0 && query.trim().length >= 2) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 shadow-[var(--shadow-modal)]">
          <p className="text-xs text-[var(--text-muted)]">일치하는 추천어가 없습니다.</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            검색어를 더 구체적으로 입력해보세요.
          </p>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50">
      <ul
        id="hero-autosuggest-list"
        className="max-h-[min(70vh,320px)] overflow-y-auto overflow-x-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-[var(--shadow-modal)]"
        role="listbox"
        aria-label="검색 추천 목록"
      >
        {suggestions.map((item, index) => (
          <li
            key={item.id}
            id={`hero-suggestion-${index}`}
            role="option"
            aria-selected={index === highlightedIndex}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item, index);
            }}
            onMouseEnter={() => onMouseEnterItem(index)}
            className={cn(
              "flex cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition",
              index === highlightedIndex
                ? "bg-[var(--primary-soft)] text-[var(--foreground)]"
                : "text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
            )}
          >
            <span
              className={cn(
                "shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold",
                item.type === "destination" && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
                item.type === "theme" && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
                item.type === "product" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
              )}
            >
              {TYPE_LABELS[item.type]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.label}</p>
              {item.sublabel ? (
                <p className="truncate text-[11px] text-[var(--text-muted)]">{item.sublabel}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 6) `src/components/home/HeroRecommendedLinks.tsx` (전체)

```tsx
import Link from "next/link";

const PHRASES: { label: string; href: string }[] = [
  { label: "지역별 여행", href: "/destinations" },
  { label: "테마별 여행", href: "/themes" },
  { label: "여행추천", href: "/recommended" },
];

/**
 * 관리자에서 설정한 추천 탐색 문구를 표시합니다.
 * 문구 안의 "지역별 여행", "테마별 여행", "추천여행"을 해당 링크로 렌더링합니다.
 */
export function HeroRecommendedLinks({ text }: { text: string }) {
  if (!text.trim()) return null;

  let remaining = text;
  const nodes: React.ReactNode[] = [];
  let key = 0;

  for (const { label, href } of PHRASES) {
    const i = remaining.indexOf(label);
    if (i === -1) continue;
    const before = remaining.slice(0, i);
    if (before) nodes.push(<span key={key++}>{before}</span>);
    nodes.push(
      <Link key={key++} href={href} className="underline hover:no-underline">
        {label}
      </Link>,
    );
    remaining = remaining.slice(i + label.length);
  }
  if (remaining) nodes.push(<span key={key++}>{remaining}</span>);

  if (nodes.length === 0) return <>{text}</>;
  return <>{nodes}</>;
}
```

---

## 7) `src/components/home/DestinationSection.tsx` (전체)

```tsx
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { HomeTaxonomyGrid } from "@/components/home/HomeTaxonomyGrid";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import { cn } from "@/lib/cn";

export type DestinationSectionProps = {
  /** 홈에 노출할 destination 목록 (최대 8개 권장) */
  items: ProductTaxonomy[];
  /** 섹션 상단 라벨(eyebrow). 비어 있으면 메인에서 표시하지 않음 */
  eyebrow?: string | null;
  /** 섹션 제목. 비어 있으면 메인에서 표시하지 않음 */
  title?: string | null;
  /** 섹션 부제목. 비어 있으면 메인에서 표시하지 않음 */
  description?: string | null;
  className?: string;
};

/**
 * 홈 Destination 섹션.
 * 여행지 기반 탐색의 첫 진입점. 카드 그리드는 허브/목록과 재사용 가능한 구조.
 */
export default function DestinationSection({
  items,
  eyebrow,
  title,
  description,
  className,
}: DestinationSectionProps) {
  if (items.length === 0) return null;

  return (
    <SectionBlock surface="none" padding="md" className={cn("space-y-3 sm:space-y-4", className)}>
      <SectionHeader
        eyebrow={eyebrow?.trim() || undefined}
        title={title?.trim() || undefined}
        description={description?.trim() || undefined}
        align="left"
      />
      <HomeTaxonomyGrid items={items} type="destination" layout="horizontal-scroll" />
    </SectionBlock>
  );
}
```

---

## 8) `src/components/home/ThemeSection.tsx` (전체)

```tsx
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { HomeTaxonomyGrid } from "@/components/home/HomeTaxonomyGrid";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import { cn } from "@/lib/cn";

export type ThemeSectionProps = {
  /** 홈에 노출할 theme 목록 (최대 8개 권장) */
  items: ProductTaxonomy[];
  /** 섹션 상단 라벨(eyebrow). 비어 있으면 메인에서 표시하지 않음 */
  eyebrow?: string | null;
  /** 섹션 제목. 비어 있으면 메인에서 표시하지 않음 */
  title?: string | null;
  /** 섹션 부제목. 비어 있으면 메인에서 표시하지 않음 */
  description?: string | null;
  className?: string;
};

/**
 * 홈 Theme 섹션.
 * Destination 다음 단계의 탐색 축. 추후 product_taxonomies(theme) 연결 확장 용이.
 */
export default function ThemeSection({
  items,
  eyebrow,
  title,
  description,
  className,
}: ThemeSectionProps) {
  if (items.length === 0) return null;

  return (
    <SectionBlock surface="none" padding="md" className={cn("space-y-3 sm:space-y-4", className)}>
      <SectionHeader
        eyebrow={eyebrow?.trim() || undefined}
        title={title?.trim() || undefined}
        description={description?.trim() || undefined}
        align="left"
      />
      <HomeTaxonomyGrid items={items} type="theme" layout="horizontal-scroll" />
    </SectionBlock>
  );
}
```

---

## 9) `src/components/home/HomeTaxonomyGrid.tsx` (전체)

```tsx
"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import {
  getDestinationLandingHref,
  getThemeLandingHref,
  getProductLineLandingHref,
} from "@/lib/hubLandingLinks";
import {
  CARD_HOVER,
  CARD_TRANSITION,
  CARD_PADDING_HOME,
  CARD_IMAGE_ASPECT_HOME,
} from "@/lib/cardTokens";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SCROLL_AMOUNT = 320;

const FALLBACK_IMAGE = "https://picsum.photos/seed/thealltour-home/800/500";

export type HomeTaxonomyGridLayout = "grid" | "horizontal-scroll";

export type HomeTaxonomyGridProps = {
  items: ProductTaxonomy[];
  type: "destination" | "theme" | "product_line";
  className?: string;
  /** grid: 2열(모바일)~4열. horizontal-scroll: 가로 스크롤 카드 (지역 섹션용) */
  layout?: HomeTaxonomyGridLayout;
};

function getHref(item: ProductTaxonomy, type: HomeTaxonomyGridProps["type"]): string {
  switch (type) {
    case "destination":
      return getDestinationLandingHref(item);
    case "theme":
      return getThemeLandingHref(item);
    case "product_line":
      return getProductLineLandingHref(item);
    default:
      return "/products";
  }
}

/**
 * 홈용 taxonomy 탐색 카드 그리드.
 * 모바일: 이미지 16:9, 텍스트 이미지 아래, 설명 1줄.
 * 지역: 가로 스크롤 / 테마: 2열 그리드 (layout으로 분기).
 */
export function HomeTaxonomyGrid({
  items,
  type,
  className,
  layout = "grid",
}: HomeTaxonomyGridProps) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || layout !== "horizontal-scroll") return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState);
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [layout, updateScrollState]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -SCROLL_AMOUNT : SCROLL_AMOUNT, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  const isHorizontalScroll = layout === "horizontal-scroll";

  const listContent = (
    <ul
      ref={isHorizontalScroll ? scrollRef : undefined}
      className={cn(
        isHorizontalScroll
          ? "flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 sm:mx-0 sm:px-0"
          : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
        !isHorizontalScroll && className,
      )}
      aria-label={type === "destination" ? "지역별 탐색" : type === "theme" ? "테마별 탐색" : "상품군별 탐색"}
    >
      {items.map((item) => {
        const href = getHref(item, type);
        const title = item.card_title?.trim() || item.name;
        const description = item.card_description?.trim() || null;
        const imageUrl = item.card_image_url?.trim() || null;

        return (
          <li
            key={item.id}
            className={cn(
              isHorizontalScroll && "min-w-[72%] sm:min-w-[260px] shrink-0",
            )}
          >
            <Link
              href={href}
              className={cn(
                "group flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] sm:rounded-2xl",
                CARD_HOVER,
                CARD_TRANSITION,
              )}
            >
              <div className={cn("relative w-full shrink-0 overflow-hidden bg-[var(--surface-muted)]", CARD_IMAGE_ASPECT_HOME)}>
                <Image
                  src={imageUrl || FALLBACK_IMAGE}
                  alt=""
                  fill
                  sizes={isHorizontalScroll ? "(max-width: 640px) 72vw, 260px" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"}
                  className="object-cover transition duration-200 group-hover:scale-[1.02]"
                />
              </div>
              <div className={cn("flex flex-1 flex-col", CARD_PADDING_HOME)}>
                <h3 className="font-card-title text-sm font-semibold leading-tight text-[var(--foreground)]">
                  {title}
                </h3>
                {description ? (
                  <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-muted)] md:type-caption">
                    {description}
                  </p>
                ) : null}
                <span className="mt-2 inline-flex items-center text-xs font-medium text-[var(--primary)] sm:mt-3 md:section-label">
                  자세히 보기
                  <span className="ml-1" aria-hidden>→</span>
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  if (isHorizontalScroll) {
    return (
      <div className={cn("relative group/scroll", className)}>
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="왼쪽으로 스크롤"
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-soft)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition opacity-90 hover:opacity-100 -translate-x-1 sm:translate-x-0"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="오른쪽으로 스크롤"
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-soft)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition opacity-90 hover:opacity-100 translate-x-1 sm:translate-x-0"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden />
          </button>
        )}
        {listContent}
      </div>
    );
  }

  return listContent;
}
```

---

## 10) 레이아웃 보조: `PageContainer`, `SectionBlock`, `SectionHeader` (전체)

### `src/components/layout/PageContainer.tsx`

```tsx
"use client";

import { cn } from "@/lib/cn";

export type PageContainerSize = "reading" | "default" | "wide" | "full";

export type PageContainerProps = {
  children: React.ReactNode;
  /** reading: 1040px, default: 1280px, wide: 1600px, full: 제한 없음 */
  size?: PageContainerSize;
  className?: string;
};

const SIZE_CLASS: Record<PageContainerSize, string> = {
  reading: "max-w-[1040px]",
  default: "max-w-[1280px]",
  wide: "max-w-[1600px]",
  full: "max-w-none",
};

/**
 * 유저 페이지 공통 폭·패딩 컨테이너.
 * 홈/상품목록/상품상세/문서형 페이지에 공통 적용 가능.
 */
export function PageContainer({
  children,
  size = "default",
  className,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        "px-4 sm:px-6 lg:px-8 xl:px-10",
        SIZE_CLASS[size],
        className
      )}
    >
      {children}
    </div>
  );
}
```

### `src/components/layout/SectionBlock.tsx`

```tsx
"use client";

import { cn } from "@/lib/cn";

export type SectionBlockSurface = "none" | "muted" | "card";
export type SectionBlockPadding = "none" | "sm" | "md" | "lg";

export type SectionBlockProps = {
  children: React.ReactNode;
  id?: string;
  className?: string;
  /** 헤더 영역(예: SectionHeader)을 감쌀 때 적용할 클래스 */
  headerClassName?: string;
  /** 배경/박스 스타일. none: 투명, muted: surface-muted, card: surface+ring */
  surface?: SectionBlockSurface;
  /** 내부 패딩 */
  padding?: SectionBlockPadding;
  /** 헤더 영역(선택). 있으면 headerClassName으로 감싸서 상단에 렌더 */
  header?: React.ReactNode;
};

const SURFACE_CLASS: Record<SectionBlockSurface, string> = {
  none: "bg-transparent",
  muted: "bg-[var(--surface-muted)] ring-1 ring-[var(--border)]",
  card: "bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow-soft)]",
};

const PADDING_CLASS: Record<SectionBlockPadding, string> = {
  none: "p-0",
  sm: "p-4 sm:p-5",
  md: "p-5 sm:p-6 md:p-8",
  lg: "p-6 sm:p-8 md:p-10",
};

/**
 * 섹션 블록. spacing·surface·padding 통일.
 * 홈/목록/상세 공통 사용 가능.
 */
export function SectionBlock({
  children,
  id,
  className,
  headerClassName,
  surface = "none",
  padding = "md",
  header,
}: SectionBlockProps) {
  return (
    <section
      id={id}
      className={cn(
        "space-y-6",
        SURFACE_CLASS[surface],
        padding === "none" ? "" : "rounded-2xl sm:rounded-3xl",
        PADDING_CLASS[padding],
        className
      )}
    >
      {header ? (
        <div className={cn(headerClassName)}>{header}</div>
      ) : null}
      {children}
    </section>
  );
}
```

### `src/components/layout/SectionHeader.tsx`

```tsx
"use client";

import { cn } from "@/lib/cn";

export type SectionHeaderProps = {
  /** 상단 라벨 (선택) */
  eyebrow?: React.ReactNode;
  /** 섹션 제목 */
  title?: React.ReactNode;
  /** 부가 설명 (선택) */
  description?: React.ReactNode;
  /** 오른쪽 CTA 링크 등 (선택). 모바일에서는 헤더 아래로 배치 */
  action?: React.ReactNode;
  /** 정렬. left 시 왼쪽 블록 + 오른쪽 action, center 시 모두 가운데 */
  align?: "left" | "center";
  className?: string;
  /** h2에 부여할 id (섹션 aria-labelledby 연결용) */
  titleId?: string;
};

/** 섹션 CTA용 텍스트 링크 스타일 (전체보기 등) */
export const SECTION_HEADER_CTA_CLASS =
  "inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline";

/**
 * 섹션 헤더. 홈·랜딩 등 섹션 공통.
 * 레이아웃: 왼쪽(eyebrow + title + description) / 오른쪽(action). 모바일에서는 action이 아래로 배치.
 * 타이포: eyebrow(caption), title(display semibold 반응형), description(small muted).
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  align = "left",
  className,
  titleId,
}: SectionHeaderProps) {
  const hasTop = Boolean(eyebrow ?? title ?? description);
  const isCenter = align === "center";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4",
        isCenter && "sm:flex-col sm:items-center sm:text-center",
        className
      )}
    >
      <div className={cn("space-y-1", isCenter && "flex flex-col sm:items-center")}>
        {eyebrow ? (
          <p className="type-caption tracking-wide text-[var(--text-muted)]">{eyebrow}</p>
        ) : null}
        {title ? (
          <h2
            id={titleId}
            className="heading-display font-semibold text-lg text-[var(--foreground)] sm:text-xl lg:text-2xl"
          >
            {title}
          </h2>
        ) : null}
        {description ? (
          <p className={cn("type-small max-w-[640px] text-[var(--text-muted)]", isCenter && "sm:mx-auto")}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className={cn("shrink-0", hasTop && isCenter && "sm:pt-1")}>{action}</div>
      ) : null}
    </div>
  );
}
```

---

## 11) 홈 하단 CTA(참고): `src/components/HeroQuickConsultButton.tsx` (전체)

```tsx
"use client";

import { useState, FormEvent } from "react";
import { usePathname } from "next/navigation";
import { Send, X } from "lucide-react";

type QuickFormState = {
  name: string;
  phone: string;
  content: string;
};

const initialFormState: QuickFormState = {
  name: "",
  phone: "",
  content: "",
};

export default function HeroQuickConsultButton() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<QuickFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  function formatPhoneInput(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    setTimeout(() => {
      setToast(null);
    }, 2600);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.content.trim()) {
      showToast("error", "이름, 연락처, 문의 내용을 모두 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          source_path: `${pathname || "/"}#hero-quick-consult`,
        }),
      });

      if (!response.ok) {
        showToast("error", "문의 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      setForm(initialFormState);
      setIsOpen(false);
      showToast("success", "빠른 상담 요청이 접수되었습니다. 확인 후 순차적으로 연락드리겠습니다.");
    } catch {
      showToast("error", "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--primary)] bg-[var(--primary)] px-4 text-[14px] font-semibold text-[var(--on-primary)] transition-colors duration-150 hover:bg-[var(--primary-hover)] hover:border-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] md:px-6 md:text-[15px]"
      >
        <Send
          className="h-4 w-4 opacity-90"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <span>1:1 상담 문의</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-[2px]">
          <div className="flex min-h-full items-center justify-center px-4 py-6">
            <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 text-[var(--text-primary)] shadow-[var(--shadow-modal)]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-[var(--text-muted)]">
                    THEALL QUICK CONSULT
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)] md:text-2xl">
                    프리미엄 상담 요청 남기기
                  </h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)] md:text-sm">
                    간단한 정보만 남겨주시면, 전담 상담사가 순차적으로 연락드립니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                  aria-label="상담 모달 닫기"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="flex flex-col gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  <label className="space-y-1.5">
                    <span>이름 *</span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      placeholder="성함을 입력해 주세요"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                      required
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  <label className="space-y-1.5">
                    <span>연락처 *</span>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          phone: formatPhoneInput(event.target.value),
                        }))
                      }
                      placeholder="010-0000-0000"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                      required
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  <label className="space-y-1.5">
                    <span>문의 내용 *</span>
                    <textarea
                      rows={4}
                      value={form.content}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, content: event.target.value }))
                      }
                      placeholder="예: 5월 중 일본 골프 3박 4일, 4인 강습 포함 일정 희망"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                      required
                    />
                  </label>
                </div>

                <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-[10px] text-[var(--text-muted)] md:text-xs">
                    남겨주신 연락처로만 상담 연락을 드리며, 다른 용도로는 사용하지 않습니다.
                  </p>
                  <div className="flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full border border-[var(--primary)] bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--on-primary)] transition-colors duration-150 hover:bg-[var(--primary-hover)] hover:border-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-70"
                    >
                      {isSubmitting ? "전송 중..." : "상담 신청"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed top-4 right-4 z-50">
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold shadow-lg text-[var(--on-primary)] ${
              toast.kind === "success" ? "bg-[var(--success)]" : "bg-[var(--danger)]"
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </>
  );
}
```

---

## 12) 데이터 소스 (전체 또는 발췌)

### `src/lib/heroContent.ts` (전체)

```ts
import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import type { HomeHeroContent } from "@/types/homeHeroContent";
import { DEFAULT_HERO_CONTENT } from "@/types/homeHeroContent";

function normalize(row: Record<string, unknown> | null): HomeHeroContent | null {
  if (!row) return null;
  return {
    id: String(row.id ?? ""),
    badge: typeof row.badge === "string" ? row.badge : null,
    main_copy_accent: typeof row.main_copy_accent === "string" ? row.main_copy_accent : null,
    main_copy_tail: typeof row.main_copy_tail === "string" ? row.main_copy_tail : null,
    sub_description: typeof row.sub_description === "string" ? row.sub_description : null,
    bullet_1: typeof row.bullet_1 === "string" ? row.bullet_1 : null,
    bullet_2: typeof row.bullet_2 === "string" ? row.bullet_2 : null,
    bullet_3: typeof row.bullet_3 === "string" ? row.bullet_3 : null,
    recommended_text: typeof row.recommended_text === "string" ? row.recommended_text : null,
    search_placeholder: typeof row.search_placeholder === "string" ? row.search_placeholder : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

/** 공개용: 캐시된 히어로 문구 1건 (없으면 null) */
export async function getHeroContent(): Promise<HomeHeroContent | null> {
  return getHeroContentCached();
}

const getHeroContentCached = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("home_hero_content")
      .select("*")
      .limit(1)
      .order("created_at", { ascending: true })
      .maybeSingle();

    return normalize((data ?? null) as Record<string, unknown> | null);
  },
  ["home-hero-content"],
  { revalidate: 10, tags: ["home-hero-content"] },
);

/** 기본값 포함한 문구 반환 (공개 페이지용) */
export function resolveHeroContent(content: HomeHeroContent | null) {
  if (!content)
    return {
      badge: DEFAULT_HERO_CONTENT.badge,
      main_copy_accent: DEFAULT_HERO_CONTENT.main_copy_accent,
      main_copy_tail: DEFAULT_HERO_CONTENT.main_copy_tail,
      sub_description: DEFAULT_HERO_CONTENT.sub_description,
      bullet_1: DEFAULT_HERO_CONTENT.bullet_1,
      bullet_2: DEFAULT_HERO_CONTENT.bullet_2,
      bullet_3: DEFAULT_HERO_CONTENT.bullet_3,
      recommended_text: DEFAULT_HERO_CONTENT.recommended_text,
      search_placeholder: DEFAULT_HERO_CONTENT.search_placeholder,
    };
  return {
    badge: content.badge ?? DEFAULT_HERO_CONTENT.badge,
    main_copy_accent: content.main_copy_accent ?? DEFAULT_HERO_CONTENT.main_copy_accent,
    main_copy_tail: content.main_copy_tail ?? DEFAULT_HERO_CONTENT.main_copy_tail,
    sub_description: content.sub_description ?? DEFAULT_HERO_CONTENT.sub_description,
    bullet_1: content.bullet_1 ?? DEFAULT_HERO_CONTENT.bullet_1,
    bullet_2: content.bullet_2 ?? DEFAULT_HERO_CONTENT.bullet_2,
    bullet_3: content.bullet_3 ?? DEFAULT_HERO_CONTENT.bullet_3,
    recommended_text: content.recommended_text ?? DEFAULT_HERO_CONTENT.recommended_text,
    search_placeholder: content.search_placeholder ?? DEFAULT_HERO_CONTENT.search_placeholder,
  };
}
```

### `src/types/homeHeroContent.ts` (전체)

```ts
/** 홈 히어로 문구 설정 (관리자에서 편집, 단일 행) */
export type HomeHeroContent = {
  id: string;
  badge: string | null;
  main_copy_accent: string | null;
  main_copy_tail: string | null;
  sub_description: string | null;
  bullet_1: string | null;
  bullet_2: string | null;
  bullet_3: string | null;
  recommended_text: string | null;
  search_placeholder: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export const DEFAULT_HERO_CONTENT: Omit<HomeHeroContent, "id" | "created_at" | "updated_at"> = {
  badge: "THEALL TOUR PREMIUM GOLF",
  main_copy_accent: "품격 있는",
  main_copy_tail: " 골프와 여행의 시작",
  sub_description:
    "전담 상담사가 1:1 맞춤 설계를 진행하여, 일정·동행 구성·예산에 맞는 골프&여행 코스를 함께 정리해 드립니다.",
  bullet_1: "전화·메신저로 편하게 상담 시작",
  bullet_2: "일정·항공·골프장까지 한 번에 비교 제안",
  bullet_3: "출발 전·후 안내까지 전담 상담사가 지속 케어",
  recommended_text: "또는 지역별 여행 · 테마별 여행 · 추천여행 으로 탐색",
  search_placeholder: "지역, 테마, 상품명을 검색해보세요 (예: 일본 골프, 남미 여행)",
};
```

### `src/lib/siteSettings.ts` (전체)

> **199줄 전체** — 저장소 `src/lib/siteSettings.ts`와 동일합니다. 이 문서에 이미 요약 없이 붙이면 길이가 매우 커지므로, **파일을 직접 열어 복사**하거나 IDE에서 `docs`로 export 하세요.

**홈과 직접 연관된 필드:**

- `home_region_card_ids`, `home_region_section_*`
- `home_theme_card_ids`, `home_theme_section_*`
- `parseHomeRegionCardIds`, `parseHomeThemeCardIds`

### `src/lib/hubLandingLinks.ts` (전체)

> **85줄** — 저장소 `src/lib/hubLandingLinks.ts` 원본과 동일 (랜딩 slug 규칙).

### `src/lib/homeBanners.ts` (전체)

```ts
import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import type { HomeBanner } from "@/types/homeBanner";

function normalizeBanner(row: Record<string, unknown>): HomeBanner {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? "메인 배너"),
    image_url: String(row.image_url ?? ""),
    mobile_image_url:
      typeof row.mobile_image_url === "string" && row.mobile_image_url.trim() !== ""
        ? row.mobile_image_url
        : null,
    link_url:
      typeof row.link_url === "string" && row.link_url.trim() !== "" ? row.link_url : null,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : null,
    is_active: typeof row.is_active === "boolean" ? row.is_active : true,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
  };
}

export async function getHomeBanners() {
  return getHomeBannersCached();
}

const getHomeBannersCached = unstable_cache(
  async () => {
    const result = await supabase
      .from("home_banners")
      .select("id, title, image_url, mobile_image_url, link_url, sort_order, is_active, created_at")
      .eq("is_active", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false });

    if (result.error) return [] as HomeBanner[];
    return (result.data ?? []).map((row) => normalizeBanner(row as Record<string, unknown>));
  },
  ["home-banners:active"],
  { revalidate: 120, tags: ["home-banners"] },
);
```

### `src/types/homeBanner.ts` (전체)

```ts
export type HomeBanner = {
  id: string;
  title: string;
  image_url: string;
  mobile_image_url?: string | null;
  link_url?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
  created_at?: string | null;
};
```

### `src/lib/productTaxonomies.ts` — 허브 destination/theme 조회 발췌

```ts
/** 허브 페이지용: 활성 + 허브 노출인 destination(지역) 목록. */
const getHubDestinationsCached = unstable_cache(
  async (): Promise<ProductTaxonomy[]> => {
    const result = await supabase
      .from("product_taxonomies")
      .select("*")
      .eq("taxonomy_type", "destination")
      .eq("is_active", true)
      .eq("is_hub_visible", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (result.error) return [];
    return (result.data ?? []).map((r) => mapTaxonomy(r as Record<string, unknown>));
  },
  ["product-taxonomies:hub-destinations"],
  { revalidate: 300, tags: [CACHE_TAGS.TAXONOMY, CACHE_TAGS.HEADER_NAV] },
);

/** 허브 페이지용: 활성 + 허브 노출인 theme(테마) 목록. */
const getHubThemesCached = unstable_cache(
  async (): Promise<ProductTaxonomy[]> => {
    const result = await supabase
      .from("product_taxonomies")
      .select("*")
      .eq("taxonomy_type", "theme")
      .eq("is_active", true)
      .eq("is_hub_visible", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (result.error) return [];
    return (result.data ?? []).map((r) => mapTaxonomy(r as Record<string, unknown>));
  },
  ["product-taxonomies:hub-themes"],
  { revalidate: 300, tags: [CACHE_TAGS.TAXONOMY, CACHE_TAGS.HEADER_NAV] },
);

export async function getHubDestinations(): Promise<ProductTaxonomy[]> {
  return getHubDestinationsCached();
}

export async function getHubThemes(): Promise<ProductTaxonomy[]> {
  return getHubThemesCached();
}
```

*(전체 `mapTaxonomy` 및 나머지 함수는 `src/lib/productTaxonomies.ts` 참고.)*

---

## 13) 기타 연결 파일 (홈 상단)

| 역할 | 경로 |
|------|------|
| 사이트 헤더 | `src/components/SiteHeader.tsx` |
| 큐레이션 섹션 (Hero 다음 이후) | `src/components/home/CuratedProductsSection.tsx` |
| 홈 큐레이션 데이터 | `src/lib/homeCurated.ts` |

---

## 부록 A) `src/components/home/HomeHeroSearch.tsx` (전체 원문)

```tsx
"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import { useDebounce } from "@/hooks/useDebounce";
import HeaderSearchDropdown from "@/components/HeaderSearchDropdown";
import SearchSuggestionsDropdown from "@/components/search/SearchSuggestionsDropdown";
import { cn } from "@/lib/cn";
import type { SearchSuggestion } from "@/types/search";

const HERO_RECENT_KEY = "hero_recent_searches";
const MAX_RECENT = 5;
const DEBOUNCE_MS = 250;

const DEFAULT_PLACEHOLDER =
  "지역, 테마, 상품명을 검색해보세요 (예: 일본 골프, 남미 여행, 태국 휴양)";

type RecommendedKeyword = {
  id: string;
  keyword: string;
};

type HomeHeroSearchProps = {
  placeholder?: string | null;
  /** 모바일 뷰에서 검색창 아래 '최근 검색어' 칩 블록 미노출 (PR22: 검색 중심 Hero) */
  hideRecentSearchesOnMobile?: boolean;
  /** hero-mobile: 모바일에서 full width, 라운드·시인성 강화 */
  variant?: "default" | "hero-mobile";
};

function saveRecentSearch(keyword: string) {
  if (typeof window === "undefined") return;
  try {
    const stored = JSON.parse(window.localStorage.getItem(HERO_RECENT_KEY) || "[]") as string[];
    const updated = [keyword, ...stored.filter((k) => k !== keyword)].slice(0, MAX_RECENT);
    window.localStorage.setItem(HERO_RECENT_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HERO_RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function HomeHeroSearch({ placeholder, hideRecentSearchesOnMobile = false, variant = "default" }: HomeHeroSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recommended, setRecommended] = useState<RecommendedKeyword[]>([]);
  const [isLoadingRecommended, setIsLoadingRecommended] = useState(false);
  const [recommendedLoaded, setRecommendedLoaded] = useState(false);
  const [autoSuggestions, setAutoSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFetchRef = useRef<string>("");
  const impressionTrackedRef = useRef<string | null>(null);
  const submitSourceRef = useRef<"button" | "enter">("enter");

  const trimmedQuery = useMemo(() => query.trim(), [query]);
  const debouncedQuery = useDebounce(trimmedQuery, DEBOUNCE_MS);
  const displayPlaceholder = placeholder?.trim() || DEFAULT_PLACEHOLDER;

  const showAutosuggest = isFocused && trimmedQuery.length >= 2;
  const showRecentRecommended = isFocused && trimmedQuery.length < 2;

  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

  useEffect(() => {
    if (!showAutosuggest) {
      setAutoSuggestions([]);
      setHighlightedIndex(-1);
      impressionTrackedRef.current = null;
      return;
    }
    if (debouncedQuery.length < 2) {
      setAutoSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }

    const reqId = debouncedQuery;
    lastFetchRef.current = reqId;
    setIsLoadingSuggestions(true);
    setAutoSuggestions([]);
    setHighlightedIndex(-1);

    fetch(`/api/search/suggestions?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => res.json())
      .then((data: { suggestions?: SearchSuggestion[] }) => {
        if (lastFetchRef.current !== reqId) return;
        const list = data.suggestions ?? [];
        setAutoSuggestions(list);
        setHighlightedIndex(list.length > 0 ? 0 : -1);
        if (list.length > 0 && impressionTrackedRef.current !== reqId) {
          impressionTrackedRef.current = reqId;
          trackClientEvent(
            createAnalyticsPayload({
              eventName: ANALYTICS_EVENTS.hero_autosuggest_impression,
              source: ANALYTICS_SOURCES.hero_search,
              query: debouncedQuery,
              resultCount: list.length,
              pagePath: typeof window !== "undefined" ? window.location.pathname : null,
              deviceType: inferDeviceType("desktop"),
            }),
          );
        }
      })
      .catch(() => {
        if (lastFetchRef.current === reqId) setAutoSuggestions([]);
      })
      .finally(() => {
        if (lastFetchRef.current === reqId) setIsLoadingSuggestions(false);
      });
  }, [debouncedQuery, showAutosuggest]);

  useEffect(() => {
    if (!showAutosuggest) return;
    setHighlightedIndex((i) => {
      if (autoSuggestions.length === 0) return -1;
      return Math.max(-1, Math.min(i, autoSuggestions.length - 1));
    });
  }, [autoSuggestions.length, showAutosuggest]);

  useEffect(() => {
    if (!isFocused || recommendedLoaded) return;
    let cancelled = false;
    async function load() {
      try {
        setIsLoadingRecommended(true);
        const res = await fetch("/api/search/recommended", { cache: "no-store" });
        if (!res.ok) return;
        const result = (await res.json()) as { items?: { id: string; keyword: string }[] };
        if (!cancelled && Array.isArray(result.items)) {
          setRecommended(result.items);
          setRecommendedLoaded(true);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setIsLoadingRecommended(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isFocused, recommendedLoaded]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsFocused(false);
        setHighlightedIndex(-1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSearch = useCallback(
    (submitSource: "button" | "enter" | "suggestion") => {
      if (!trimmedQuery) return;
      saveRecentSearch(trimmedQuery);
      setRecentSearches(loadRecentSearches());
      setIsFocused(false);
      setHighlightedIndex(-1);
      setAutoSuggestions([]);

      trackClientEvent(
        createAnalyticsPayload({
          eventName: ANALYTICS_EVENTS.hero_search_submit,
          source: ANALYTICS_SOURCES.hero_search,
          query: trimmedQuery,
          section: submitSource,
          pagePath: typeof window !== "undefined" ? window.location.pathname : null,
          deviceType: inferDeviceType("desktop"),
        }),
      );
      trackClientEvent(
        createAnalyticsPayload({
          eventName: ANALYTICS_EVENTS.hero_search,
          source: ANALYTICS_SOURCES.hero_search,
          query: trimmedQuery,
          pagePath: typeof window !== "undefined" ? window.location.pathname : null,
          deviceType: inferDeviceType("desktop"),
        }),
      );

      router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
    },
    [trimmedQuery, router],
  );

  const handleSelectSuggestion = useCallback(
    (item: SearchSuggestion, index: number) => {
      saveRecentSearch(item.label);
      setRecentSearches(loadRecentSearches());
      setIsFocused(false);
      setQuery("");
      setHighlightedIndex(-1);
      setAutoSuggestions([]);

      trackClientEvent(
        createAnalyticsPayload({
          eventName: ANALYTICS_EVENTS.hero_autosuggest_click,
          source: ANALYTICS_SOURCES.hero_search,
          query: trimmedQuery,
          section: item.type,
          label: item.label,
          position: index,
          pagePath: typeof window !== "undefined" ? window.location.pathname : null,
          deviceType: inferDeviceType("desktop"),
        }),
      );
      trackClientEvent(
        createAnalyticsPayload({
          eventName: ANALYTICS_EVENTS.hero_search_submit,
          source: ANALYTICS_SOURCES.hero_search,
          query: trimmedQuery,
          section: "suggestion",
          pagePath: typeof window !== "undefined" ? window.location.pathname : null,
          deviceType: inferDeviceType("desktop"),
        }),
      );
      trackClientEvent(
        createAnalyticsPayload({
          eventName: ANALYTICS_EVENTS.hero_search,
          source: ANALYTICS_SOURCES.hero_search,
          query: trimmedQuery,
          pagePath: typeof window !== "undefined" ? window.location.pathname : null,
          deviceType: inferDeviceType("desktop"),
        }),
      );

      router.push(item.href);
    },
    [trimmedQuery, router],
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (showAutosuggest && highlightedIndex >= 0 && autoSuggestions[highlightedIndex]) {
      handleSelectSuggestion(autoSuggestions[highlightedIndex], highlightedIndex);
      return;
    }
    const source = submitSourceRef.current;
    submitSourceRef.current = "enter";
    handleSearch(source);
  }

  function handleSelectKeyword(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    saveRecentSearch(trimmed);
    setRecentSearches(loadRecentSearches());
    setIsFocused(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") submitSourceRef.current = "enter";
    if (!showAutosuggest || autoSuggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearch("enter");
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i < autoSuggestions.length - 1 ? i + 1 : i));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i > 0 ? i - 1 : -1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && autoSuggestions[highlightedIndex]) {
        handleSelectSuggestion(autoSuggestions[highlightedIndex], highlightedIndex);
      } else {
        handleSearch("enter");
      }
      return;
    }
  }

  return (
    <div className="space-y-2">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className={cn(
          "relative mx-auto w-full",
          variant === "hero-mobile" ? "max-w-full md:max-w-[720px]" : "max-w-[720px]",
        )}
        role="search"
        aria-label="상품 검색"
      >
        <div
          className={cn(
            "flex items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-4 py-2 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] transition focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)] sm:px-5 sm:py-2.5",
            variant === "hero-mobile"
              ? "rounded-2xl sm:rounded-[1.25rem] md:rounded-full"
              : "rounded-full",
          )}
        >
          <Search className="h-5 w-5 shrink-0 text-[var(--text-muted)] md:h-5 md:w-5" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 180)}
            placeholder={displayPlaceholder}
            className={cn(
              "min-h-10 flex-1 bg-transparent text-base text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)] sm:min-h-12 sm:text-[15px]",
              variant === "hero-mobile" && "min-h-11 sm:min-h-12",
            )}
            autoComplete="off"
            aria-label="검색어"
            aria-autocomplete="list"
            aria-controls="hero-autosuggest-list"
            aria-expanded={showAutosuggest}
            aria-activedescendant={
              highlightedIndex >= 0 && autoSuggestions[highlightedIndex]
                ? `hero-suggestion-${highlightedIndex}`
                : undefined
            }
          />
          <button
            type="submit"
            onMouseDown={() => (submitSourceRef.current = "button")}
            className={cn(
              "shrink-0 rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--on-primary)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 sm:px-6 sm:py-3 sm:text-base",
              variant === "hero-mobile" && "px-4 py-2.5 sm:px-6 sm:py-3",
            )}
          >
            검색
          </button>
        </div>

        {showAutosuggest && (
          <SearchSuggestionsDropdown
            open
            suggestions={autoSuggestions}
            highlightedIndex={highlightedIndex}
            isLoading={isLoadingSuggestions}
            query={trimmedQuery}
            onSelect={handleSelectSuggestion}
            onMouseEnterItem={setHighlightedIndex}
          />
        )}

        {showRecentRecommended && (
          <HeaderSearchDropdown
            open
            mode="desktop"
            query={query}
            recentSearches={recentSearches}
            recommended={recommended}
            isLoadingRecommended={isLoadingRecommended}
            productSuggestions={[]}
            onSelectKeyword={handleSelectKeyword}
          />
        )}
      </form>

      {recentSearches.length > 0 && !showAutosuggest ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 pt-1",
            hideRecentSearchesOnMobile && "hidden md:flex",
          )}
        >
          <span className="text-[11px] font-semibold text-[var(--hero-text-secondary)]/90">
            최근 검색어
          </span>
          <div className="flex flex-wrap gap-1.5">
            {recentSearches.map((keyword) => (
              <Link
                key={keyword}
                href={`/search?q=${encodeURIComponent(keyword)}`}
                className="inline-flex items-center rounded-full border border-[var(--hero-badge-border)] bg-[var(--hero-badge-bg)]/80 px-3 py-1 text-xs text-[var(--hero-text-primary)] transition hover:bg-[var(--hero-badge-bg)]"
              >
                {keyword}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

---

## 부록 B) `src/lib/hubLandingLinks.ts` (전체)

```ts
/**
 * 허브/상세 랜딩 링크 생성 규칙.
 *
 * - 상세 랜딩이 열려 있으면(is_landing_enabled / landing_enabled && slug):
 *   /destinations/[slug], /themes/[slug], /recommended/[slug]
 * - 아니면 fallback: /products?region=..., /products?theme=..., /recommended 또는 /products
 *
 * 상세 랜딩 URL은 DB의 slug 컬럼이 있을 때만 사용 (get*BySlug 조회 가능하도록).
 */

import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { HomeCuratedSection } from "@/types/homeCurated";
import { isLandingEnabled, isRecommendedLandingEnabled, hasValidSlug } from "@/lib/hubVisibility";

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * destination(지역) 항목 카드 클릭 시 이동 URL.
 * is_landing_enabled && slug 있으면 /destinations/[slug], 아니면 /products/region/[slug] 또는 /products?region=...
 */
export function getDestinationLandingHref(d: ProductTaxonomy): string {
  const rawSlug = d.slug?.trim();
  const slug = rawSlug ? normalizeSlug(rawSlug) : null;
  const nameSlug = d.name.trim() ? normalizeSlug(d.name) : "";

  if (slug && hasValidSlug(slug) && isLandingEnabled(d)) {
    return `/destinations/${encodeURIComponent(slug)}`;
  }
  if (slug) return `/products/region/${encodeURIComponent(slug)}`;
  if (nameSlug) return `/products/region/${encodeURIComponent(nameSlug)}`;
  return `/products?region=${encodeURIComponent(d.name)}`;
}

/**
 * theme 항목 카드 클릭 시 이동 URL.
 * is_landing_enabled && slug 있으면 /themes/[slug], 아니면 /products/theme/[slug] 또는 /products?theme=...
 */
export function getThemeLandingHref(t: ProductTaxonomy): string {
  const rawSlug = t.slug?.trim();
  const slug = rawSlug ? normalizeSlug(rawSlug) : null;
  const nameSlug = t.name.trim() ? normalizeSlug(t.name) : "";

  if (slug && hasValidSlug(slug) && isLandingEnabled(t)) {
    return `/themes/${encodeURIComponent(slug)}`;
  }
  if (slug) return `/products/theme/${encodeURIComponent(slug)}`;
  if (nameSlug) return `/products/theme/${encodeURIComponent(nameSlug)}`;
  return `/products?theme=${encodeURIComponent(t.name)}`;
}

/**
 * 추천 섹션 항목 클릭 시 이동 URL.
 * landing_enabled && slug 있으면 /recommended/[slug], 아니면 허브(/recommended) 또는 /products.
 */
export function getRecommendedLandingHref(section: HomeCuratedSection): string {
  const rawSlug = section.slug?.trim();
  const slug = rawSlug ? rawSlug.toLowerCase().replace(/\s+/g, "-") : "";
  if (slug && isRecommendedLandingEnabled(section)) {
    return `/recommended/${encodeURIComponent(slug)}`;
  }
  return "/recommended";
}

/**
 * 상품군(product_line) 항목 클릭 시 이동 URL.
 * 상세 랜딩 없음 → /products?product_line=name (필터 연결).
 */
export function getProductLineLandingHref(t: ProductTaxonomy): string {
  const name = (t.name ?? "").trim();
  if (!name) return "/products";
  return `/products?product_line=${encodeURIComponent(name)}`;
}

/** @deprecated getDestinationLandingHref 사용 권장 */
export function buildDestinationHubHref(d: ProductTaxonomy): string {
  return getDestinationLandingHref(d);
}

/** @deprecated getThemeLandingHref 사용 권장 */
export function buildThemeHubHref(t: ProductTaxonomy): string {
  return getThemeLandingHref(t);
}
```

## 부록 C) `src/lib/siteSettings.ts` (전체)

```ts
import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";

export type SiteSettings = {
  kakao_channel_url: string;
  instagram_url: string;
  kakao_chat_url: string;
  company_name: string;
  ceo_name: string;
  address: string;
  business_reg_no: string;
  tourism_reg_no: string;
  mail_order_reg_no: string;
  main_phone: string;
  main_email: string;
  products_hero_headline: string;
  products_hero_subcopy: string;
  products_hero_regions: string;
  golf_hero_headline: string;
  golf_hero_subcopy: string;
  golf_hero_regions: string;
  /** 메인 홈 DESTINATIONS 섹션에 노출할 지역(taxonomy) id 목록. JSON 배열 문자열. 비어 있으면 허브 노출 지역 전체를 기본 순서로 사용. */
  home_region_card_ids: string;
  /** 메인 홈 지역 섹션 상단 문구: eyebrow(작은 라벨). 비어 있으면 "DESTINATIONS" 사용 */
  home_region_section_eyebrow: string;
  /** 메인 홈 지역 섹션 제목. 비어 있으면 "어디로 떠나고 싶으신가요?" 사용 */
  home_region_section_title: string;
  /** 메인 홈 지역 섹션 부제목. 비어 있으면 "지역별 여행 상품을 만나보세요." 사용 */
  home_region_section_description: string;
  /** 메인 홈 THEME 섹션에 노출할 테마(taxonomy) id 목록. JSON 배열 문자열. 비어 있으면 허브 노출 테마 전체를 기본 순서로 사용. 최대 8개. */
  home_theme_card_ids: string;
  /** 메인 홈 테마 섹션 상단 문구: eyebrow(작은 라벨). 비어 있으면 "TRAVEL THEMES" 사용 */
  home_theme_section_eyebrow: string;
  /** 메인 홈 테마 섹션 제목. 비어 있으면 "이런 여행은 어떠세요?" 사용 */
  home_theme_section_title: string;
  /** 메인 홈 테마 섹션 부제목. 비어 있으면 "테마별로 여행 상품을 둘러보세요." 사용 */
  home_theme_section_description: string;
  about_kicker: string;
  about_title: string;
  about_paragraph1: string;
  about_paragraph2: string;
  about_cta_label: string;
  about_cta_href: string;
};

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  kakao_channel_url: process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL ?? "https://pf.kakao.com",
  instagram_url: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "https://www.instagram.com/thealltour",
  kakao_chat_url: process.env.NEXT_PUBLIC_KAKAO_CHAT_URL ?? "https://pf.kakao.com",
  company_name: "(주)더올투어",
  ceo_name: "김지호",
  address: "경기도 고양시 덕양구 용현로 27, 407호(행신동, 행신프라자)",
  business_reg_no: "645-88-03583",
  tourism_reg_no: "미정",
  mail_order_reg_no: "미정",
  main_phone: "02-0000-0000",
  main_email: "thealltour@gmail.com",
  products_hero_headline:
    "패키지상품으로 원하시는 지역·예산에 맞춰 바로 상담까지 연결해 드려요.",
  products_hero_subcopy:
    "골프/패키지, 가족·지인·단체 여행까지. 관심 있는 지역과 대략적인 일정만 알려주시면, 담당자가 상품을 추려 1:1로 안내해 드립니다.",
  products_hero_regions: JSON.stringify([
    { id: "japan", label: "일본 골프·패키지", searchKeyword: "일본" },
    { id: "se-asia", label: "동남아 골프·휴양", searchKeyword: "동남아" },
    { id: "europe", label: "유럽 여행", searchKeyword: "유럽" },
    { id: "domestic", label: "국내·제주", searchKeyword: "국내" },
  ]),
  golf_hero_headline: "골프/파크골프 전문 맞춤 설계로 라운딩 동선을 깔끔하게 잡아드립니다.",
  golf_hero_subcopy:
    "선호하는 골프장, 라운딩 횟수, 동행 인원과 예산을 알려주시면, 시즌에 맞는 최적의 골프투어 코스를 추천해 드립니다.",
  golf_hero_regions: JSON.stringify([
    { id: "golf-japan", label: "일본 골프투어", searchKeyword: "일본 골프" },
    { id: "golf-se-asia", label: "동남아 골프투어", searchKeyword: "동남아 골프" },
    { id: "golf-domestic", label: "국내 골프/파크골프", searchKeyword: "국내 골프" },
  ]),
  home_region_card_ids: "[]",
  home_region_section_eyebrow: "DESTINATIONS",
  home_region_section_title: "어디로 떠나고 싶으신가요?",
  home_region_section_description: "지역별 여행 상품을 만나보세요.",
  home_theme_card_ids: "[]",
  home_theme_section_eyebrow: "TRAVEL THEMES",
  home_theme_section_title: "이런 여행은 어떠세요?",
  home_theme_section_description: "테마별로 여행 상품을 둘러보세요.",
  about_kicker: "ABOUT THEALL TOUR",
  about_title: "여행을 디자인해 드립니다",
  about_paragraph1:
    "당신 만의 특별한 여정이 되어야 할 여행, 똑같은 패키지 여행에 지치셨나요? 더올투어는 정형화된 일정이 아닌, 고객 한 분 한 분의 취향과 목적에 맞춘 '큐레이팅 여행'을 지향합니다.",
  about_paragraph2:
    "수년간 쌓아온 노하우와 탄탄한 현지 네트워크를 바탕으로, 남들은 모르는 숨은 명소부터 프라이빗한 숙소까지 세밀하게 설계해 드립니다. 전문가의 시선으로 고른 고품격 여행, 이제 더올투어와 함께 시작하세요.",
  about_cta_label: "맞춤 여행 상담 받기",
  about_cta_href: "/#contact",
};

async function fetchSiteSettingsRaw(): Promise<SiteSettings> {
  const { data, error } = await supabase.from("site_settings").select("key, value");

  if (error || !data) {
    return DEFAULT_SITE_SETTINGS;
  }

  const map = new Map<string, string>();
  for (const row of data as { key: string; value: string }[]) {
    if (!row || !row.key) continue;
    map.set(row.key, row.value ?? "");
  }

  return {
    kakao_channel_url: map.get("kakao_channel_url") || DEFAULT_SITE_SETTINGS.kakao_channel_url,
    instagram_url: map.get("instagram_url") || DEFAULT_SITE_SETTINGS.instagram_url,
    kakao_chat_url: map.get("kakao_chat_url") || DEFAULT_SITE_SETTINGS.kakao_chat_url,
    company_name: map.get("company_name") || DEFAULT_SITE_SETTINGS.company_name,
    ceo_name: map.get("ceo_name") || DEFAULT_SITE_SETTINGS.ceo_name,
    address: map.get("address") || DEFAULT_SITE_SETTINGS.address,
    business_reg_no: map.get("business_reg_no") || DEFAULT_SITE_SETTINGS.business_reg_no,
    tourism_reg_no: map.get("tourism_reg_no") || DEFAULT_SITE_SETTINGS.tourism_reg_no,
    mail_order_reg_no: map.get("mail_order_reg_no") || DEFAULT_SITE_SETTINGS.mail_order_reg_no,
    main_phone: map.get("main_phone") || DEFAULT_SITE_SETTINGS.main_phone,
    main_email: map.get("main_email") || DEFAULT_SITE_SETTINGS.main_email,
    products_hero_headline:
      map.get("products_hero_headline") || DEFAULT_SITE_SETTINGS.products_hero_headline,
    products_hero_subcopy:
      map.get("products_hero_subcopy") || DEFAULT_SITE_SETTINGS.products_hero_subcopy,
    products_hero_regions:
      map.get("products_hero_regions") || DEFAULT_SITE_SETTINGS.products_hero_regions,
    golf_hero_headline:
      map.get("golf_hero_headline") || DEFAULT_SITE_SETTINGS.golf_hero_headline,
    golf_hero_subcopy:
      map.get("golf_hero_subcopy") || DEFAULT_SITE_SETTINGS.golf_hero_subcopy,
    golf_hero_regions:
      map.get("golf_hero_regions") || DEFAULT_SITE_SETTINGS.golf_hero_regions,
    home_region_card_ids:
      map.get("home_region_card_ids") ?? DEFAULT_SITE_SETTINGS.home_region_card_ids,
    home_region_section_eyebrow:
      map.get("home_region_section_eyebrow") ?? DEFAULT_SITE_SETTINGS.home_region_section_eyebrow,
    home_region_section_title:
      map.get("home_region_section_title") ?? DEFAULT_SITE_SETTINGS.home_region_section_title,
    home_region_section_description:
      map.get("home_region_section_description") ?? DEFAULT_SITE_SETTINGS.home_region_section_description,
    home_theme_card_ids:
      map.get("home_theme_card_ids") ?? DEFAULT_SITE_SETTINGS.home_theme_card_ids,
    home_theme_section_eyebrow:
      map.get("home_theme_section_eyebrow") ?? DEFAULT_SITE_SETTINGS.home_theme_section_eyebrow,
    home_theme_section_title:
      map.get("home_theme_section_title") ?? DEFAULT_SITE_SETTINGS.home_theme_section_title,
    home_theme_section_description:
      map.get("home_theme_section_description") ?? DEFAULT_SITE_SETTINGS.home_theme_section_description,
    about_kicker: map.get("about_kicker") || DEFAULT_SITE_SETTINGS.about_kicker,
    about_title: map.get("about_title") || DEFAULT_SITE_SETTINGS.about_title,
    about_paragraph1:
      map.get("about_paragraph1") || DEFAULT_SITE_SETTINGS.about_paragraph1,
    about_paragraph2:
      map.get("about_paragraph2") || DEFAULT_SITE_SETTINGS.about_paragraph2,
    about_cta_label:
      map.get("about_cta_label") || DEFAULT_SITE_SETTINGS.about_cta_label,
    about_cta_href: map.get("about_cta_href") || DEFAULT_SITE_SETTINGS.about_cta_href,
  };
}

/** 5분 캐시 — 관리자에서 site_settings 수정 시 revalidateTag("site-settings") 호출 필요 */
export async function getSiteSettings(): Promise<SiteSettings> {
  return unstable_cache(
    fetchSiteSettingsRaw,
    ["site-settings"],
    { revalidate: 300, tags: ["site-settings"] },
  )();
}

/** 메인 홈 지역카드에 노출할 destination taxonomy id 목록 (순서 유지). 비어 있으면 설정 미사용. */
export function parseHomeRegionCardIds(settings: Pick<SiteSettings, "home_region_card_ids">): string[] {
  const raw = settings.home_region_card_ids?.trim() ?? "";
  if (!raw || raw === "[]") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());
  } catch {
    return [];
  }
}

/** 메인 홈 테마카드에 노출할 theme taxonomy id 목록 (순서 유지). 비어 있으면 설정 미사용. 최대 8개 사용 권장. */
export function parseHomeThemeCardIds(settings: Pick<SiteSettings, "home_theme_card_ids">): string[] {
  const raw = settings.home_theme_card_ids?.trim() ?? "";
  if (!raw || raw === "[]") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim())
      .slice(0, 8);
  } catch {
    return [];
  }
}
```

---

**문서 생성일:** 저장소 스냅샷 기준. 코드 변경 시 원본 TSX/TS와 diff를 확인하세요.
