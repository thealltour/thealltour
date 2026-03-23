# 가이드 브리지 UX 디테일 — 타 페이지 적용 검토용 코드 발췌

> 목적: `/guides/[slug]`에서 정리한 정보 위계·spacing·카드·모바일 밀도·대표 vs 확장 구분을 `/`, `/products`, `/destinations/[slug]`, `/themes/[slug]`에 옮길 때 참고할 **실제 렌더 트리·컴포넌트** 정리.
>
> 발췌 시점: 저장소 기준. 일부 파일은 길이상 **전체** 또는 **연속 블록**으로 수록.

---

## 1. 홈 `/` — `src/app/page.tsx`

### 1.1 import 블록

```1:20:src/app/page.tsx
import type { Metadata } from "next";
import { ShieldCheck, Users, Route, CheckCircle2 } from "lucide-react";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { getHomeCuratedData } from "@/lib/homeCurated";
import { getHomeBanners } from "@/lib/homeBanners";
import { getHeroContent, resolveHeroContent } from "@/lib/heroContent";
import { getHubDestinations, getHubThemes } from "@/lib/productTaxonomies";
import { getSiteSettings, parseHomeRegionCardIds, parseHomeThemeCardIds } from "@/lib/siteSettings";
import { getHomeGuidesWithTaxonomyNames } from "@/lib/guides";
import { getTopRatedPublishedReviews } from "@/lib/reviews";
import HeroQuickConsultButton from "@/components/inquiry/HeroQuickConsultButton";
import HeroSection from "@/components/home/HeroSection";
import DestinationSection from "@/components/home/DestinationSection";
import ThemeSection from "@/components/home/ThemeSection";
import CuratedProductsSection from "@/components/home/CuratedProductsSection";
import { HomeGuideSection } from "@/components/home/HomeGuideSection";
import { HomeReviewSection } from "@/components/home/HomeReviewSection";
```

### 1.2 메타데이터·신뢰/상담 카피 상수

- `META_TITLE`, `META_DESC`, `TRUST_*`, `T1`~`T4`, `C_*` 등 **한글/유니코드 이스케이프 문자열**은 **라인 21–65** (원본 파일 전체 참고).

### 1.3 `Home` 컴포넌트 — 데이터 로딩 + 본문 렌더 (핵심)

```67:130:src/app/page.tsx
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
        <main className="flex w-full min-w-0 max-w-full flex-col pb-6 sm:pb-10 md:pb-14">
          <HeroSection heroBanners={topBanners} hero={hero} />

          <PageContainer
            size="wide"
            className="flex flex-col max-md:gap-10 max-md:pt-8 md:gap-20 md:pt-0"
          >
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
```

- 이어서 **신뢰 그리드** `SectionBlock` + **상담 CTA** `SectionBlock` (`id="contact"`) — **라인 131–218** (원본 참고).

---

## 1.4 홈 — 지역/테마 레일 `DestinationSection` / `ThemeSection`

```1:59:src/components/home/DestinationSection.tsx
import Link from "next/link";
import {
  SECTION_HEADER_MOBILE_CTA_CLASS,
  HOME_MAIN_SECTION_BLOCK_CLASS,
} from "@/components/layout/SectionHeader";
import { ExploreRailSection } from "@/components/explore/ExploreRailSection";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import { cn } from "@/lib/cn";

// ... types ...

export default function DestinationSection({
  items,
  eyebrow,
  title,
  description,
  className,
}: DestinationSectionProps) {
  if (items.length === 0) return null;

  return (
    <ExploreRailSection
      layoutPreset="home"
      surface="none"
      padding="md"
      sectionBlockClassName={cn(HOME_MAIN_SECTION_BLOCK_CLASS, className)}
      eyebrow={eyebrow?.trim() || undefined}
      title={title?.trim() || undefined}
      description={description?.trim() || undefined}
      action={
        <Link
          href="/destinations"
          className={SECTION_HEADER_MOBILE_CTA_CLASS}
          aria-label="인기 여행지 더보기"
        >
          더보기
          <span aria-hidden>→</span>
        </Link>
      }
      taxonomyType="destination"
      items={items}
      listAriaLabel="지역별 탐색"
    />
  );
}
```

`ThemeSection`은 동일 패턴으로 `href="/themes"`, `taxonomyType="theme"`, `listAriaLabel="테마별 탐색"`.

---

## 1.5 홈 — 큐레이션 상품 `CuratedProductsSection` + `CuratedSectionScrollBlock`

```1:83:src/components/home/CuratedProductsSection.tsx
import Link from "next/link";
import { cn } from "@/lib/cn";
import { SectionBlock } from "@/components/layout/SectionBlock";
import {
  SectionHeader,
  SECTION_HEADER_MOBILE_CTA_CLASS,
  HOME_MAIN_SECTION_BLOCK_CLASS,
} from "@/components/layout/SectionHeader";
import { CuratedSectionScrollBlock } from "@/components/home/CuratedSectionScrollBlock";
// ...

export default function CuratedProductsSection({
  settings,
  sections,
  className,
}: CuratedProductsSectionProps) {
  const isActive = settings?.is_active === true && sections.length > 0;
  const hasMultipleSections = sections.length >= 2;

  if (isActive) {
    return (
      <SectionBlock
        surface="none"
        padding="md"
        className={cn(HOME_MAIN_SECTION_BLOCK_CLASS, className)}
      >
        <SectionHeader
          eyebrow={settings!.section_label?.trim() || undefined}
          title={settings!.section_title}
          description={settings!.section_description}
          action={
            <Link
              href="/recommended"
              className={SECTION_HEADER_MOBILE_CTA_CLASS}
              aria-label="THEALL PICKS 더보기"
            >
              더보기
              <span aria-hidden>→</span>
            </Link>
          }
        />

        <div className="mx-auto flex w-full max-w-[1344px] flex-col gap-8 max-md:gap-10">
          {sections.map((sec) => (
            <CuratedSectionScrollBlock
              key={sec.id}
              section={sec}
              showTitle={hasMultipleSections}
            />
          ))}
        </div>
      </SectionBlock>
    );
  }

  return (
    <SectionBlock surface="card" padding="md" className={cn("!px-4 !py-3 sm:!p-6 md:!p-8", className)}>
      <p className="type-small text-[var(--text-muted)]">
        메인 추천 상품이 없습니다. 관리자 페이지에서 추천 상품을 체크해 주세요.
      </p>
    </SectionBlock>
  );
}
```

```19:44:src/components/home/CuratedSectionScrollBlock.tsx
export function CuratedSectionScrollBlock({
  section,
  showTitle = false,
  className,
}: CuratedSectionScrollBlockProps) {
  if (section.products.length === 0) return null;

  return (
    <div className={cn("space-y-3 sm:space-y-4", className)}>
      {showTitle && section.title ? (
        <h3 className="font-card-title text-base font-semibold text-[var(--foreground)] md:text-lg">
          {section.title}
        </h3>
      ) : null}
      <ProductCardGridSection homeCuratedMobileCompact desktopGridCols={4}>
        {section.products.map((product) => (
          <HomeProductCard
            key={product.id}
            product={product}
            analyticsSection={section.title ?? undefined}
          />
        ))}
      </ProductCardGridSection>
    </div>
  );
}
```

> **참고:** 홈 큐레이션은 `ProductCard`가 아니라 **`HomeProductCard`** (`src/components/products/HomeProductCard.tsx`).

---

## 1.6 홈 — 가이드 `HomeGuideSection`

```60:118:src/components/home/HomeGuideSection.tsx
  return (
    <SectionBlock
      surface="none"
      padding="md"
      className={cn("space-y-2 sm:space-y-4 !p-3 sm:!p-6 md:!p-8", className)}
    >
      <SectionHeader
        title="여행 준비에 도움이 되는 가이드"
        description="지역별·테마별 꿀팁과 가이드를 만나보세요."
        action={
          <Link
            href="/guides"
            className={SECTION_HEADER_MOBILE_CTA_CLASS}
            aria-label="여행 가이드 더보기"
          >
            더보기
            <span aria-hidden>→</span>
          </Link>
        }
        align="left"
      />
      <div className="relative group/scroll">
        {/* 좌우 스크롤 버튼 ... */}
        <ul
          ref={scrollRef}
          className="flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
          aria-label="여행 가이드"
        >
          {guides.map((guide) => (
            <li
              key={guide.id}
              className="flex w-[58%] max-w-[300px] shrink-0 self-stretch sm:w-[260px] sm:max-w-none md:w-[272px]"
            >
              <GuideCard guide={guide} className="w-full min-w-0" />
            </li>
          ))}
        </ul>
      </div>
    </SectionBlock>
  );
```

---

## 2. 상품 목록 `/products` — `src/app/products/page.tsx` (전체)

```1:86:src/app/products/page.tsx
import SiteHeader from "@/components/site-chrome/SiteHeader";
import ProductsHero from "@/components/product-detail/ProductsHero";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
import { getProducts } from "@/lib/products";
import { getProductTaxonomyOptions, getHubDestinations, getHubThemes, buildRegionTree, buildThemeTree, buildTaxonomyNameMap, getActiveProductLineTaxonomies } from "@/lib/productTaxonomies";
import {
  resolveLandingParams,
  hasLandingParams,
} from "@/lib/productFiltersLanding";

// ... ProductsPageProps searchParams ...

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const query = (await searchParams) ?? {};
  const searchKeyword = typeof query.q === "string" ? query.q.trim() : "";
  const tourType = typeof query.tourType === "string" ? query.tourType.trim() : "";
  const golfPresetActive = tourType === "golf-park";
  const presetCategories = golfPresetActive ? ["골프투어", "파크골프투어"] : undefined;
  const products = await getProducts();
  const [taxonomyOptions, destinations, hubThemes, productLineTaxonomies] = await Promise.all([
    getProductTaxonomyOptions(products),
    getHubDestinations(),
    getHubThemes(),
    getActiveProductLineTaxonomies(),
  ]);
  const { categories, themes, productLines } = taxonomyOptions;
  const regionTree = buildRegionTree(destinations);
  const themeTree = buildThemeTree(hubThemes);
  const taxonomyNameMap = buildTaxonomyNameMap([
    ...destinations,
    ...hubThemes,
    ...productLineTaxonomies,
  ]);

  const landingResolved =
    hasLandingParams(query) ? await resolveLandingParams(query) : null;
  const initialFiltersFromServer = landingResolved?.initialFilters ?? null;
  const initialKeywordFromLanding = landingResolved?.initialKeyword ?? "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] text-[var(--text-primary)]">
      <SiteHeader activeTab="products" searchQuery={searchKeyword} golfPresetActive={golfPresetActive} />

      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-6">
          <ProductsHero variant={golfPresetActive ? "golf" : "package"} />

          {products.length === 0 ? (
            <section className="rounded-2xl bg-[var(--surface)] p-8 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] type-small text-[var(--text-muted)] sm:rounded-3xl">
              현재 등록된 상품이 없습니다. 관리자 페이지에서 상품을 등록해 주세요.
            </section>
          ) : (
            <ProductsPageContent
              products={products}
              taxonomyNameMap={taxonomyNameMap}
              regionOptions={categories}
              regionTree={regionTree}
              themeOptions={themes}
              themeTree={themeTree}
              productLineOptions={productLines}
              initialKeyword={initialKeywordFromLanding || searchKeyword}
              presetCategories={presetCategories}
              presetLabel={golfPresetActive ? "골프/파크골프" : undefined}
              initialFiltersFromServer={initialFiltersFromServer}
              regionTaxonomies={destinations}
              themeTaxonomies={hubThemes}
            />
          )}
        </PageContainer>
      </main>
    </div>
  );
}
```

---

## 2.1 `ProductsPageContent` — 필터·모바일·`ProductCatalogSection` 연결

```203:266:src/components/products/ProductsPageContent.tsx
  return (
    <div className="flex w-full max-w-full gap-8 items-start">
      <ProductFilterSidebar
        regionOptions={regionOptions}
        regionTree={regionTree}
        themeOptions={themeOptions}
        themeTree={themeTree}
        productLineOptions={productLineOptions}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      <div className="min-w-0 flex-1 space-y-4">
        {/* 모바일 전용: 필터/정렬 버튼 + 선택 칩 */}
        <div className="flex flex-wrap items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setFilterDrawerOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 type-small font-semibold text-[var(--foreground)] transition-colors active:bg-[var(--surface-muted)]"
            aria-label="필터 열기"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
            필터
          </button>
          <button
            type="button"
            onClick={() => setSortSheetOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 type-small font-semibold text-[var(--foreground)] transition-colors active:bg-[var(--surface-muted)]"
            aria-label="정렬 열기"
          >
            <ArrowDownUp className="h-4 w-4 shrink-0" aria-hidden />
            {sortLabel ?? "정렬"}
          </button>
        </div>

        <div className="space-y-2">
          {filterContextLabel && (
            <p className="type-small text-[var(--text-muted)]" role="status">
              {filterContextLabel}
            </p>
          )}
          <ProductFilterChips
            filters={filters}
            onRemoveRegion={() => handleFilterChange({ region: null })}
            onRemoveTheme={() => handleFilterChange({ theme: null })}
            onRemoveProductLine={() => handleFilterChange({ product_line: null })}
            onRemoveKeyword={() => handleFilterChange({ q: null })}
            onRemoveSort={() => handleFilterChange({ sort: "" })}
          />
        </div>

        <ProductCatalogSection
          products={filteredProducts}
          categories={regionOptions}
          initialKeyword={initialKeyword}
          presetCategories={presetCategories}
          presetLabel={presetLabel}
          initialRegion={filters.region}
          initialTheme={filters.theme}
          onCategoryChange={(region) => handleFilterChange({ region: region ?? null })}
          onThemeChange={(theme) => handleFilterChange({ theme: theme ?? null })}
          onResetFilters={handleResetFilters}
          cardLayout={cardLayout}
        />
      </div>
      {/* MobileProductFilterDrawer, MobileProductSortSheet ... */}
    </div>
  );
```

- `cardLayout` 기본 `"list"`; **지역/테마 랜딩 하단**에서는 `"related"`로 전달.

---

## 3. 지역 랜딩 `/destinations/[slug]` — `src/app/destinations/[slug]/page.tsx`

### 3.1 import + 데이터 요약

```1:38:src/app/destinations/[slug]/page.tsx
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
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
// ... taxonomies, guides, reviews, subnodes ...
```

### 3.2 레이아웃: 히어로 → (lg) `HubFilterSidebar` + 본문 컬럼 → 하단 전체 상품 섹션

```137:287:src/app/destinations/[slug]/page.tsx
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
                {/* HubBrowseCard ... */}
              </ul>
            </SectionBlock>
          ) : null}

          <LandingSubCardsSection contextTitle={destination.name} nodes={subnodes} />

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
                <Link href="/guides" className="type-btn inline-flex rounded-xl border ...">
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

          {/* 후기 SectionBlock + ReviewHighlightCard ... */}
            </div>
          </div>

          <section
            className="min-h-screen border-t border-[var(--border)] bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] pt-10 mt-12 sm:mt-16"
            aria-labelledby="products-section-heading"
          >
            <div className="mx-auto w-full max-w-6xl px-3 py-8 sm:px-6 sm:py-10 md:px-10 md:py-14">
              <div className="flex flex-col gap-8">
                <h2 id="products-section-heading" className="section-heading type-h2 text-[var(--foreground)] first:mt-0">
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
```

> **참고:** `CuratedBlock`에 `hubLandingLayout` 미전달 시 기본 `false` → `ProductCardGridSection`은 일반 모바일 레일.

---

## 4. 테마 랜딩 `/themes/[slug]` — `src/app/themes/[slug]/page.tsx`

구조는 **지역 랜딩과 동형**: `LandingDetailHero` → `HubFilterSidebar`(`initialFilters={{ theme: theme.name }}`) → 자식 테마 그리드 / `LandingSubCardsSection` / 가이드 / `CuratedBlock` / 후기 → 하단 `section` + `h2` + `ProductsPageContent` (`basePath={`/themes/${slug}`}`, `cardLayout="related"`).

- 전체 파일: **라인 1–297** (원본과 동일 패턴).

---

## 5. 공통 — `CuratedBlock` (허브 대표 상품)

```29:58:src/components/home/CuratedBlock.tsx
export default function CuratedBlock({
  title,
  description,
  products,
  surface = "none",
  hubLandingLayout = false,
}: CuratedBlockProps) {
  if (!products || products.length === 0) return null;

  return (
    <section className={cn("space-y-3 sm:space-y-4", SURFACE_CLASS[surface])}>
      <SectionHeader
        title={title}
        description={description}
      />

      <ProductCardGridSection hubLandingLayout={hubLandingLayout}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            {...productToProductCardProps(product, {
              layout: "grid",
              analyticsSource: "home_curated",
              analyticsSection: title,
            })}
          />
        ))}
      </ProductCardGridSection>
    </section>
  );
}
```

---

## 6. 공통 — `ProductCatalogSection.tsx` (import + sticky 탭 + 그리드/리스트 분기)

```1:22:src/components/product-detail/ProductCatalogSection.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Product } from "@/types/product";
import ProductListCard from "@/components/products/ProductListCard";
import ProductListCardMobile from "@/components/products/ProductListCardMobile";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";
import { useConsultModal } from "@/components/inquiry/ConsultModal";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  getThemeTabs,
  groupProductsByTheme,
  matchesThemeTab,
  matchesProductTab,
  type ProductCategoryTabId,
} from "@/lib/productCategory";
```

**상단 sticky + `categoryTabs` / `themeTabs` + 선택 상태 (`activeTab`, `activeThemeTab`, `isUrlControlled`):**

```173:235:src/components/product-detail/ProductCatalogSection.tsx
    <section className="space-y-4">
      {/* 아래: sticky 요약 + 지역 칩 + 테마 칩 (함수 본문은 `return (` 로 이 블록 전에 시작) */}
      <div className="sticky top-[76px] z-20 rounded-xl border border-[var(--border)] bg-[var(--surface)]/98 px-3 py-2.5 backdrop-blur sm:rounded-xl sm:px-3 sm:py-3">
        <div className="space-y-1">
          <p className="text-xs leading-snug text-[var(--text-muted)] sm:text-sm">
            총 {keywordFilteredProducts.length}개 · 지역 {regionSummary}
          </p>
          {presetLabel ? (
            <p className="text-xs leading-snug text-[#15803d] sm:text-sm">프리셋: {presetLabel}</p>
          ) : null}
          {keyword ? (
            <p className="text-xs leading-snug text-[var(--primary)] sm:text-sm">
              검색어: {initialKeyword}
            </p>
          ) : null}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {categoryTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                if (isUrlControlled && onCategoryChange) {
                  onCategoryChange(tab === REGION_ALL_LABEL ? null : tab);
                  return;
                }
                setInternalTab(tab === REGION_ALL_LABEL ? "all" : tab);
                setInternalThemeTab(THEME_ALL_LABEL);
              }}
              className={`min-h-[32px] rounded-full px-3 py-1.5 text-sm font-medium transition ${
                (tab === REGION_ALL_LABEL ? "all" : tab) === activeTab
                  ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {themeTabs.map((tab) => (
            <button
              key={`theme-${tab}`}
              type="button"
              onClick={() => {
                if (isUrlControlled && onThemeChange) {
                  onThemeChange(tab === THEME_ALL_LABEL ? null : tab);
                  return;
                }
                setInternalThemeTab(tab);
              }}
              className={`min-h-[28px] rounded-full px-2.5 py-1 text-xs font-semibold transition sm:min-h-[32px] sm:px-3 sm:py-1.5 sm:text-sm ${
                activeThemeTab === tab
                  ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      {/* 이어서 결과 영역 <div key=...> (아래 블록) */}
```

**결과 영역: 빈 상태 / `displayGroups` + `cardLayout` 분기 (`grid` vs list+mobile):**

```237:323:src/components/product-detail/ProductCatalogSection.tsx
      <div key={`${activeTab}-${activeThemeTab}`} className="fade-in-up space-y-5">
        {keywordFilteredProducts.length === 0 ? (
          <div className="rounded-2xl bg-[var(--surface)] p-8 type-small text-[var(--text-muted)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] sm:rounded-3xl">
            {(initialRegion || initialTheme || (initialKeyword && initialKeyword.trim())) && onResetFilters ? (
              <>
                <p className="font-semibold text-[var(--text-primary)]">
                  선택한 조건에 맞는 상품이 없습니다.
                </p>
                {/* ... 필터 요약 + 전체 보기 / 필터 초기화 ... */}
              </>
            ) : keyword ? (
              "검색 조건에 맞는 상품이 없습니다."
            ) : (
              "표시할 상품이 없습니다. 지역·테마 칩을 바꿔 보세요."
            )}
          </div>
        ) : (
          displayGroups.map((group) => (
            <div key={group.theme} className="space-y-3">
              <h3 className="font-card-title type-h3 text-[var(--primary)]">{group.theme}</h3>
              {cardLayout === "related" ? (
                <ProductCardGridSection desktopGridCols={2} className="w-full max-w-[1344px]">
                  {group.products.map((product) => (
                    <ProductCard
                      key={product.id}
                      {...productToProductCardProps(product, {
                        layout: "related",
                        analyticsSource: "landing",
                        analyticsSection: "landing_catalog",
                      })}
                    />
                  ))}
                </ProductCardGridSection>
              ) : (
                <div className="flex w-full max-w-[1344px] flex-col gap-4 md:gap-5">
                  {group.products.map((product) => {
                    const cardProps = productToProductCardProps(product, {
                      analyticsSource: "product_list",
                      analyticsSection: "catalog",
                      onClickDetail: () => router.push(`/products/${product.id}`),
                      onClickConsult: () => handleProductConsult(product),
                    });

                    return (
                      <div key={product.id} className="w-full">
                        <div className="hidden md:block">
                          <ProductListCard {...cardProps} />
                        </div>
                        <div className="md:hidden">
                          <ProductListCardMobile {...cardProps} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
```

- `useMemo` 필터 체인(`filteredProducts`, `themeTabs`, `keywordFilteredProducts`, `displayGroups`)은 **라인 101–155** 원본 참고.

---

## 7. 공통 — `SectionHeader.tsx` (전체)

```1:163:src/components/layout/SectionHeader.tsx
"use client";

import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/cn";
// ... duplicateActionForLayout ...

export type SectionHeaderProps = {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
  titleId?: string;
  hideEyebrowOnTablet?: boolean;
  descriptionClassName?: string;
};

export const SECTION_HEADER_MORE_LINK_CLASS = "...";
export const HOME_MAIN_SECTION_BLOCK_CLASS =
  "space-y-4 sm:space-y-5 !px-4 !py-3 sm:!p-6 md:!p-8";

export function SectionHeader({ ... }: SectionHeaderProps) {
  // center 분기: flex-col items-center gap-3, title h2, description p + descriptionClassName
  // left 분기: space-y-2 sm:flex sm:items-end, eyebrow+title / description / action
}
```

---

## 8. 공통 — `SectionBlock.tsx` (전체)

```1:65:src/components/layout/SectionBlock.tsx
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
      {header ? <div className={cn(headerClassName)}>{header}</div> : null}
      {children}
    </section>
  );
}
```

---

## 9. 공통 — `ProductCard.tsx` (전체 구조 요약)

- **Props:** `layout` `grid` | `list` | `related` | `stack`, `guideBridgeNarrowCopy`, `selectionHighlightLine`, `emphasizeFirstOnMobile`, `topPickLabel`, `experienceSummary` 등 (라인 **31–81**).
- **`related` + `guideBridgeNarrowCopy`:** 제목 → 가격 → `selectionHighlightLine` → 기간·별점 → 경험 요약 (라인 **315–356**).
- **`related` 일반:** 상단 기간 pill + 제목 + oneLiner + 가격 + experience (라인 **357–379**).
- **`grid`/`list`:** `gridListCardContent` — 칩·제목·oneLiner·metaLine·가격·태그·상담 (라인 **385–490**).
- **래퍼:** `Link` + `Card variant="interactive"` + `emphasizeFirstOnMobile` 시 `max-sm:ring-1` (라인 **492–530**).

원본 전체는 저장소 `src/components/products/ProductCard.tsx` 참고.

---

## 10. 공통 — `ProductCardGridSection.tsx` (전체)

- `homeCuratedMobileCompact`: 모바일 2열 그리드 `gap-x-2 gap-y-2.5`.
- `hubLandingLayout`: 모바일 스냅 레일 `min-w-[78%]`, `md+` 그리드.
- `guideBridgeTopPicksLayout` / `guideBridgeMobileTightGap` / `mobileInterstitial`: 가이드 브리지 전용.
- 기본 모바일: 가로 스크롤 `gap-3` (또는 `guideBridgeMobileTightGap` 시 `gap-1.5`).

---

## 11. 적용 검토 요약

### 11.1 홈(`/`)에 적용하기 좋은 디테일

| 브리지에서 한 일 | 홈 매핑 |
|------------------|---------|
| `SectionHeader` 보조 설명 톤 (`descriptionClassName`) | `CuratedProductsSection`, `HomeGuideSection`, `ExploreRailSection` 내부 `SectionHeader` |
| 섹션 간 `PageContainer` gap / 모바일 패딩 | `max-md:gap-10`, `HOME_MAIN_SECTION_BLOCK_CLASS`, `HomeGuideSection`의 `!p-3` 등과 통일 여부 검토 |
| 카드 스캔 위계 | 홈은 **`HomeProductCard`** 경로 — `ProductCard`와 별도라면 동일 토큰(가격/메타) 정렬을 컴포넌트에 반복 적용 필요 |
| 대표 vs 확장 | 홈은 다중 `CuratedSectionScrollBlock` — 서브타이틀(`h3`) vs 메인 `SectionHeader` 위계만 존재; **구분선·타이포 단계** 추가 여지 |
| 모바일 그리드 gap | `ProductCardGridSection` `homeCuratedMobileCompact` 이미 사용 중 — 브리지 수준으로 한 단계 조정 시 여기만 보면 됨 |

### 11.2 `/products`에 적용하기 좋은 디테일

| 브리지에서 한 일 | 매핑 |
|------------------|------|
| 스티키 칩 바 + 그룹 제목 위계 | `ProductCatalogSection` 상단 박스(라인 175+) + 그룹 `h3` `type-h3 text-primary` (라인 282) |
| 모바일 밀도 | `ProductsPageContent` 필터 행 `gap-2`, `ProductCatalogSection` `space-y-4` / `space-y-5` |
| 카드 스캔 | 기본 `list`는 `ProductListCard`/`ProductListCardMobile` — **별 컴포넌트**; `related` 모드만 `ProductCard` |
| “카드 위 안내 한 줄” | URL/랜딩 모드에서 `filterContextLabel`과 유사 역할 이미 존재; 그룹 상단에 브리지식 카피를 넣으려면 `ProductCatalogSection` 확장 |

### 11.3 `/destinations/[slug]`에 적용하기 좋은 디테일

| 브리지에서 한 일 | 매핑 |
|------------------|------|
| 대표 상품 vs 전체 목록 구분 | 상단 **`CuratedBlock`** vs 하단 **`section` + h2 + `ProductsPageContent`** — 브리지의 `border-b` / 제목 톤 차등을 여기에 그대로 이식하기 좋음 |
| `SectionHeader` + 그리드 리듬 | 자식 지역·가이드·후기 블록 `mt-6` 패턴 동일 |
| `CuratedBlock` | 현재 `hubLandingLayout` 미사용 — 허브와 동일 **모바일 레일**을 쓰려면 `hubLandingLayout` 전달 검토 |
| 하단 전체 영역 | `border-t`, `mt-12`, `max-w-6xl` 패딩 — 브리지 하단 “한 덩어리 카드”와 유사하게 묶을지 정책 결정 |

### 11.4 `/themes/[slug]`에 적용하기 좋은 디테일

- **지역 랜딩과 동일 컴포넌트 트리**이므로 **11.3과 동일**.
- 차이: `initialFilters` 테마 기준, `related` 필터는 `parseThemeTokens`, 카피만 “테마”.

### 11.5 공통 컴포넌트로 묶을 수 있는 부분

| 후보 | 이유 |
|------|------|
| **`SectionHeader` + `descriptionClassName`** | 이미 가이드에서 사용; 홈·허브·`CuratedBlock`에 선택 적용 시 일관된 “부제 톤” |
| **`SectionBlock` spacing 토큰** | `space-y-6` 고정 vs 페이지별 `!space-y-4` 오버라이드가 분산되어 있음 |
| **`ProductCard` (`related`)** | `guideBridgeNarrowCopy` / `selectionHighlightLine` — **랜딩 하단 `cardLayout=related`**와 허브 `CuratedBlock`에 옵션으로 노출할지 결정 |
| **`ProductCardGridSection`** | `hubLandingLayout` / `homeCuratedMobileCompact` / 브리지 플래그가 한 파일에 모임 → **새 preset** (예: `landingFeaturedLayout`)으로 “대표 1줄 + 확장 레일”을 묶을 수 있음 |
| **`ProductCatalogSection`** | 지역·테마·상품 목록 **단일 진입점** — 스티키 칩·그룹 헤더 스타일을 바꾸면 `/products` + 랜딩 하단 전부 연쇄 |

---

## 12. 키워드 인덱스 (검색용)

| 키워드 | 주요 위치 |
|--------|-----------|
| `SectionHeader` | `ExploreRailSection`, `CuratedProductsSection`, `CuratedBlock`, `HomeGuideSection`, destinations/themes `SectionBlock` |
| `ProductCard` | `CuratedBlock`, `ProductCatalogSection` (`related`), 가이드 페이지 |
| `ProductCatalogSection` | `ProductsPageContent` |
| `HomeGuideSection` | `page.tsx` |
| `curated` / `recommended` | `CuratedProductsSection`, `CuratedSectionScrollBlock`, 링크 `/recommended` |
| `featured` (명칭) | 홈 설정 `home_curated`; 코드상 `Curated*` |
| `categoryTabs` / `themeTabs` | `ProductCatalogSection` |
| `initialRegion` / `initialTheme` | `ProductCatalogSection` props ← `ProductsPageContent`의 `filters.region/theme` |
| `mobile` / `grid` | `ProductsPageContent` (lg:hidden), `ProductCatalogSection`, `ProductCardGridSection` |
| `HubFilterSidebar` | destinations/themes `page.tsx` |
| `GuideCardGrid` | destinations/themes 가이드 섹션 |
| `ProductsPageContent` | `/products`, destinations/themes 하단 |

---

*문서 끝.*
