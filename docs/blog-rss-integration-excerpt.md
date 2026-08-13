# 네이버/티스토리 블로그 RSS 연동용 코드 발췌

요청: 기존 Next.js 사이트의 디자인 시스템·라우팅에 맞춰 RSS 피드를 연동하기 위한 코드/정보 발췌.
코드는 수정하지 않고, 관련 파일만 발췌·정리함. (작성일: 2026-08-13)

## 연동 시 참고 포인트

- App Router 사용. 페이지 루트는 `src/app/` (`pages/` 없음).
- 헤더 블로그 탭은 `/blog`로 연결됨. 가이드 목록은 `/guides`, 상세(브리지)는 `/guides/[slug]`.
- 홈(`/`)은 `PageContainer` + `SectionBlock` 레이아웃. 가이드 목록(`/blog`, `/guides`)은 `SectionBody` + `PageHero`.
- RSS 파서 패키지는 현재 `package.json`에 없음.
- `images.remotePatterns`에 네이버/티스토리 썸네일 호스트가 없음. `next/image`로 RSS 썸네일을 쓰려면 도메인 추가가 필요함.
- CSP `img-src`는 `'self' data: blob: https:` 이므로 일반 HTTPS 이미지는 CSP상 허용됨.

---

## 1. 라우터 구조 및 메인 페이지

### 1.1 App Router 개요

```
src/app/
  layout.tsx                 ← 루트 레이아웃 (헤더 없음, 푸터/토스트/상담 모달)
  page.tsx                   ← 홈 `/`
  blog/page.tsx              ← 블로그/가이드 목록 `/blog` (헤더 activeTab="blog")
  guides/page.tsx            ← 여행가이드 목록 `/guides` (검색 지원)
  guides/[slug]/page.tsx     ← 가이드 브리지 상세 `/guides/[slug]`
```

`pages/index.tsx`는 없음. Next.js App Router (`src/app`)만 사용.

### 1.2 블로그·가이드 관련 공개 라우트

| 경로 | 파일 | 역할 |
|------|------|------|
| `/` | `src/app/page.tsx` | 홈. 히어로 + 큐레이션 + 가이드 레일 + 신뢰/상담 섹션 |
| `/blog` | `src/app/blog/page.tsx` | 헤더「블로그」탭. `GuideCardList`로 가이드 카드 목록 |
| `/guides` | `src/app/guides/page.tsx` | 가이드 목록 + 검색. `GuidesListClient` |
| `/guides/[slug]` | `src/app/guides/[slug]/page.tsx` | 가이드 브리지. 노션 원문·추천 상품·관련 가이드 |

헤더 네비게이션: `src/components/site-chrome/SiteHeaderUI.tsx`에서 `href="/blog"`, `activeTab === "blog"`.

홈 가이드 섹션 CTA는 `/guides`로 이동 (`src/components/home/HomeGuideSection.tsx`).

### 1.3 레이아웃 셸 (공통)

**루트 레이아웃** `src/app/layout.tsx` (발췌)

- `ConsultModalProvider` → `AuthProvidersShell` → `{children}` → `GlobalSiteFooter` + `KakaoFloatingButton`
- 페이지별 `SiteHeader`는 각 `page.tsx`에서 직접 렌더

**폭 컨테이너** `src/components/layout/PageContainer.tsx`

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

**목록 페이지 본문** `src/components/layout/SectionBody.tsx`

```tsx
import React from "react";

type SectionBodyProps = {
  children: React.ReactNode;
  className?: string;
};

export function SectionBody({ children, className }: SectionBodyProps) {
  return <main className={`section-body ${className ?? ""}`}>{children}</main>;
}
```

**페이지 히어로** `src/components/layout/PageHero.tsx`

```tsx
import React from "react";
import { cn } from "@/lib/cn";

type PageHeroProps = {
  kicker?: string;
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  /** lg: 기본 높이(280px), sm: 슬림(120px). 콘텐츠 페이지는 sm 권장 */
  size?: "lg" | "sm";
};

export function PageHero({ kicker, title, subtitle, rightSlot, size = "lg" }: PageHeroProps) {
  return (
    <section
      className={cn(
        "page-hero flex flex-col gap-4 rounded-3xl md:flex-row md:items-center md:justify-between",
        size === "lg" ? "min-h-[280px]" : "min-h-[120px]",
        size === "sm" && "py-6 md:py-6",
      )}
    >
      <div className="space-y-2">
        {kicker ? (
          <p className="section-label text-white/80">{kicker}</p>
        ) : null}
        <h1 className="section-title type-h2 md:text-[32px] md:leading-[1.2] text-white">
          {title}
        </h1>
        {subtitle ? (
          <p className="type-small text-white/90">{subtitle}</p>
        ) : null}
      </div>
      {rightSlot ? <div className="mt-4 md:mt-0">{rightSlot}</div> : null}
    </section>
  );
}
```

### 1.4 홈 메인 페이지 전체 레이아웃

파일: `src/app/page.tsx`

```tsx
import { ShieldCheck, Users, Route, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { buildOgMetadataFromSeoData } from "@/lib/seo/buildOgPageMetadata";
import { getHomeOgPageSeo } from "@/lib/seo/getHomeOgPageSeo";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { getHomeCuratedData } from "@/lib/homeCurated";
import { getHomeBanners } from "@/lib/homeBanners";
import { getHeroContent, resolveHeroContent } from "@/lib/heroContent";
import { getHubDestinations, getHubThemes } from "@/lib/productTaxonomies";
import { getSiteSettings, parseHomeRegionCardIds, parseHomeThemeCardIds } from "@/lib/siteSettings";
import { getHomeGolfTourProducts, resolveHomeGolfTourMoreHref } from "@/lib/homeGolfTourProducts";
import { getGolfDepartureCalendarData } from "@/lib/products/getGolfDepartureCalendarProducts";
import { getHomeGuidesWithTaxonomyNames } from "@/lib/guides";
import { getTopRatedPublishedReviews } from "@/lib/reviews";
import HeroQuickConsultButton from "@/components/inquiry/HeroQuickConsultButton";
import HeroSection from "@/components/home/HeroSection";
import { HomeDeferredSections } from "@/components/home/HomeDeferredSections";

const TRUST_H3 =
  "안심하고 맡길 수 있는 여행 파트너";
const TRUST_LEAD =
  "대형 여행사와의 공식 제휴와 검증된 일정 운영 경험을 바탕으로, 안정적인 예약과 운영을 약속드립니다.";

const T1 = "대형 여행사 공식 제휴";
const T1B =
  "국내 주요 파트너와 협력하여, 검증된 상품과 안정적인 예약 시스템을 기반으로 운영합니다.";
const T2 = "전문 상담사 1:1 배정";
const T2B =
  "연령대·동행 구성·예산을 이해하는 담당자가 처음 상담부터 귀국까지 책임지고 함께하며, 필요한 내용을 차분하게 설명해 드립니다.";
const T3 = "단체·동호회 맞춤 설계";
const T3B =
  "회사·동호회·가족 모임 등 인원과 목적에 맞춘 일정으로 이동 동선과 일정 피로도를 최소화한 코스를 제안합니다.";
const T4 = "안전 기준을 통과한 일정";
const T4B =
  "현지 가이드·차량·숙소까지 사전 점검된 일정만 운영하며, 돌발 상황에도 대응 가능한 안전 프로세스를 갖추고 있습니다.";

const C_H3 =
  "프리미엄 맞춤 상담으로 여정을 설계합니다";
const C_P1 =
  "간단한 내용을 남겨주시면 전담 상담사가 전화로 먼저 연락드려, 일정과 예산을 함께 정리해 드립니다.";
const C_B1 =
  "· 통화가 편하신 시간대를 메모로 남겨주시면 최대한 맞춰 연락드립니다.";
const C_B2 =
  "· 상담 이후에도 일정 조정·추가 문의를 언제든지 편하게 요청하실 수 있습니다.";
const C_B3 =
  "· 전화 연결이 어려운 경우, 문자/메신저로도 차분히 안내해 드립니다.";
const C_H4 =
  "30초 작성 만으로 프리미엄 상담 요청이 가능합니다.";
const C_P2 =
  "성함과 연락처, 그리고 대략적인 희망사항을 남겨주세요.";
const C_P3 =
  "요청하신 부분을 최대한 반영하여 코스를 선별해드립니다.";

export const metadata: Metadata = buildOgMetadataFromSeoData(getHomeOgPageSeo());

export default async function Home() {
  const [homeCurated, topBanners, heroContent, settings, destinations, themes, golfTourProducts, golfCalendarData, homeGuides, homeReviews] =
    await Promise.all([
      getHomeCuratedData(),
      getHomeBanners(),
      getHeroContent(),
      getSiteSettings(),
      getHubDestinations(),
      getHubThemes(),
      getHomeGolfTourProducts(),
      getGolfDepartureCalendarData(),
      getHomeGuidesWithTaxonomyNames(4),
      getTopRatedPublishedReviews(4),
    ]);

  const golfTourMoreHref = await resolveHomeGolfTourMoreHref(golfTourProducts);

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
            <HomeDeferredSections
              golfTour={{
                products: golfTourProducts,
                moreHref: golfTourMoreHref,
                eyebrow: settings.home_golf_tour_section_eyebrow,
                title: settings.home_golf_tour_section_title,
                description: settings.home_golf_tour_section_description,
              }}
              golfCalendar={{
                events: golfCalendarData.events,
                promotionLegendLabel: golfCalendarData.promotionLegendLabel,
              }}
              destinationRail={{
                items: destinationsForHome,
                eyebrow: settings.home_region_section_eyebrow,
                title: settings.home_region_section_title,
                description: settings.home_region_section_description,
              }}
              themeRail={{
                items: themesForHome,
                eyebrow: settings.home_theme_section_eyebrow,
                title: settings.home_theme_section_title,
                description: settings.home_theme_section_description,
              }}
              curatedSettings={curatedSettings}
              curatedSections={curatedSections}
              homeGuides={homeGuides}
              homeReviews={homeReviews}
            />

            <SectionBlock
              surface="none"
              padding="md"
              className="!px-4 !py-3 sm:!p-6 md:!p-8"
            >
              {/* 신뢰 4카드 그리드 (모바일 세로 / md 2열 / lg 4열) */}
              {/* ... trust cards ... */}
            </SectionBlock>

            <SectionBlock
              id="contact"
              surface="none"
              padding="md"
              className="!space-y-0 !rounded-none !px-4 !pb-2 !pt-2.5 sm:!rounded-3xl sm:!p-5 sm:!pb-4 sm:!pt-5 md:!px-9 md:!pb-5 md:!pt-6 border-b border-[var(--divider)]"
            >
              {/* 상담 CTA 2열 그리드 */}
            </SectionBlock>
          </PageContainer>
        </main>
      </div>
    </>
  );
}
```

홈 레이아웃 골격 요약:

```
<> SiteHeader
  div.min-h-screen.bg-[var(--theall-page-bg)]
    main.flex.flex-col
      HeroSection
      PageContainer(size="wide")
        HomeDeferredSections   ← 골프투어/캘린더/지역/테마/큐레이션/가이드/후기
        SectionBlock           ← 신뢰 4카드
        SectionBlock#contact   ← 상담 CTA
```

### 1.5 가이드 목록 페이지 (RSS 목록 UI의 가장 가까운 기존 페이지)

파일: `src/app/guides/page.tsx`

```tsx
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { GuidesListClient } from "@/components/guides/GuidesListClient";
import { GuideSearchBar } from "@/components/guides/GuideSearchBar";
import { getPublishedNotionGuidesWithSearch } from "@/lib/guides";
import { getActiveTaxonomiesForHeader, buildGuideBadgeLabels } from "@/lib/productTaxonomies";

export const revalidate = 300;

type Props = { searchParams?: Promise<{ q?: string }> };

export default async function GuidesIndexPage({ searchParams }: Props) {
  const params = await searchParams ?? {};
  const q = typeof params.q === "string" ? params.q : undefined;
  const guides = await getPublishedNotionGuidesWithSearch(q);

  const taxonomies = await getActiveTaxonomiesForHeader();
  const idToTaxonomy = new Map(taxonomies.map((t) => [t.id, t]));

  const guidesWithBadges = guides.map((guide) => ({
    ...guide,
    badgeLabels: buildGuideBadgeLabels(guide, idToTaxonomy),
  }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="blog" />

      <SectionBody className="flex flex-col gap-[var(--space-5)] max-w-6xl">
        <PageHero
          kicker="THEALL TOUR GUIDE"
          title="여행가이드"
          subtitle="지역별 골프장 정보, 시즌별 추천 코스, 출발 전 꼭 알아두면 좋은 팁들을 정리한 가이드입니다. 카드를 누르면 가이드 브리지 페이지로 이동한 뒤, 추천 여행과 원문(노션)을 이어서 확인할 수 있습니다."
          size="sm"
        />

        <section className="space-y-4">
          <GuideSearchBar />
          <GuidesListClient guides={guidesWithBadges} />
        </section>
      </SectionBody>
    </div>
  );
}
```

파일: `src/app/blog/page.tsx` (헤더 블로그 탭 실제 도착 페이지)

```tsx
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { getPublishedGuidesWithTaxonomyNames } from "@/lib/guides";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { GuideCardList } from "@/components/guides/GuideCardList";

export default async function BlogPage() {
  const guides = await getPublishedGuidesWithTaxonomyNames();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="blog" />

      <SectionBody className="flex flex-col gap-[var(--space-5)] max-w-6xl">
        <PageHero
          kicker="THEALL TOUR GUIDE"
          title="여행가이드"
          subtitle="지역별 골프장 정보, 시즌별 추천 코스, 출발 전 꼭 알아두면 좋은 팁들을 정리한 가이드입니다. PDF는 바로 보기, 노션 연동 가이드는 카드에서 브리지(/guides/[slug])로 이동한 뒤 원문을 이어 읽을 수 있어요. 브리지 하단「가이드 전체 보기」로 이 목록에 다시 돌아올 수 있습니다."
          size="sm"
        />

        <section className="space-y-4">
          <GuideCardList guides={guides} />
        </section>
      </SectionBody>
    </div>
  );
}
```

목록 페이지 골격 요약 (RSS 피드 목록에 재사용하기 좋음):

```
div.min-h-screen.bg-gradient-to-b.from-[#f3f8ff].to-white.text-content-primary
  SiteHeader(activeTab="blog")
  SectionBody.max-w-6xl.flex.flex-col.gap-[var(--space-5)]
    PageHero(size="sm")
    section.space-y-4
      (검색바 선택)
      카드 그리드
```

---

## 2. package.json — dependencies

파일: `package.json`

Next.js `16.1.6` / React `19.2.3` / Tailwind CSS `^4` (`devDependencies`).

UI 관련: `lucide-react`, `@tanstack/react-query`, `react-day-picker`, `recharts`, `@tiptap/*`.
RSS 파서(`rss-parser` 등)는 없음.

```json
{
  "name": "theall",
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": "24.x"
  },
  "dependencies": {
    "@ai-sdk/openai": "^4.0.2",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@notionhq/client": "^5.11.0",
    "@portone/browser-sdk": "^0.1.9",
    "@sentry/nextjs": "^10.49.0",
    "@supabase/supabase-js": "^2.95.3",
    "@tanstack/react-query": "^5.90.21",
    "@tiptap/core": "^3.27.1",
    "@tiptap/pm": "^3.27.1",
    "@tiptap/react": "^3.27.1",
    "@tiptap/starter-kit": "^3.27.1",
    "ai": "^7.0.4",
    "browser-image-compression": "^2.0.2",
    "date-fns": "^4.4.0",
    "html-to-image": "^1.11.13",
    "hwpx-js": "^0.1.2",
    "jose": "^6.2.2",
    "jszip": "^3.10.1",
    "lucide-react": "^0.575.0",
    "next": "16.1.6",
    "pdfjs-dist": "^5.4.624",
    "react": "19.2.3",
    "react-day-picker": "^10.0.1",
    "react-dom": "19.2.3",
    "react-photo-view": "^1.2.7",
    "recharts": "^3.8.1",
    "server-only": "^0.0.1",
    "sharp": "^0.34.5",
    "web-push": "^3.6.7",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@next/bundle-analyzer": "^16.2.4",
    "@tailwindcss/postcss": "^4",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/web-push": "^3.6.4",
    "@vitejs/plugin-react": "^6.0.1",
    "cross-env": "^10.1.0",
    "eslint": "^9",
    "eslint-config-next": "16.1.6",
    "jsdom": "^29.0.1",
    "png-to-ico": "^3.0.1",
    "supabase": "^2.110.0",
    "tailwindcss": "^4",
    "tsx": "^4.19.2",
    "typescript": "^5",
    "vitest": "^4.1.1"
  }
}
```

---

## 3. 기존 카드/아이템 UI 컴포넌트

디자인 토큰: `var(--surface)`, `var(--border)`, `var(--shadow-soft)`, `var(--foreground)`, `var(--text-muted)`, `var(--primary)`, `rounded-2xl` / `rounded-3xl`.
타이포: `type-h3`, `type-small`, `type-caption`, `font-card-title`, `section-label`.

### 3.1 공통 Card 프리미티브

파일: `src/components/ui/Card.tsx`

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

type CardVariant = "default" | "elevated" | "hero" | "interactive";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

/** bg=--surface, border=--border, shadow=--shadow-soft, radius 16px. interactive: hover 시 shadow-soft-strong + border-strong */
export function Card({ variant = "default", className, ...props }: CardProps) {
  let variantClass: string;

  switch (variant) {
    case "elevated":
      variantClass =
        "rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-soft-strong)]";
      break;
    case "hero":
      variantClass =
        "rounded-3xl bg-[var(--theall-primary-navy)] text-[var(--site-text-primary)] " +
        "shadow-xl ring-1 ring-[var(--site-border)]";
      break;
    case "interactive":
      variantClass =
        "rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] " +
        "transition hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-soft-strong)]";
      break;
    case "default":
    default:
      variantClass =
        "rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]";
      break;
  }

  return <div className={cn(variantClass, className)} {...props} />;
}
```

### 3.2 가이드 카드 (홈/그리드용 — 디자인 시스템 토큰 기준, RSS 카드에 가장 적합)

파일: `src/components/guides/GuideCard.tsx`

핵심 Tailwind:

- 링크: `group grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-soft-strong)] hover:ring-1 hover:ring-[var(--border-strong)] … sm:rounded-3xl`
- 크기: `h-full min-h-[240px] min-w-0 max-w-full sm:min-h-[260px]`
- 이미지: `object-cover transition duration-200 group-hover:scale-[1.02]`
- 본문: `flex min-h-0 flex-col overflow-hidden p-4 sm:p-5`
- 배지: `rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption`
- 제목: `font-card-title mt-1 line-clamp-2 type-small font-semibold text-[var(--foreground)]`
- 요약: `mt-1 line-clamp-2 type-caption text-[var(--text-muted)]`
- CTA: `mt-auto inline-flex items-center pt-3 section-label text-[var(--primary)]`

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import type { Guide } from "@/types/guide";
import { getGuideHref } from "@/lib/guides";
import { cn } from "@/lib/cn";
import { GUIDE_CARD_FALLBACK_IMAGE, pickGuidePreferredImageUrl } from "@/lib/guides/imageUrl";

export type GuideCardProps = {
  guide: Guide;
  className?: string;
  /** 요약/태그 표시 줄 수 등 조정용. 기본은 카드형 */
  variant?: "default" | "compact";
};

/** 이미지:텍스트 = 5:5(50%:50%). 행 높이는 카드 전체(h-full) 기준으로 균일. */
const CARD_LINK_CLASS =
  "group grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-soft-strong)] hover:ring-1 hover:ring-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 sm:rounded-3xl";

/**
 * 단일 가이드 카드. 썸네일, 제목, 요약, 카테고리/태그 일부.
 * 클릭 시 /guides/[slug] 브리지(또는 slug 없으면 landing /blog)로 이동. 노션은 브리지에서 연다.
 */
export function GuideCard({
  guide,
  className,
  variant = "default",
}: GuideCardProps) {
  const href = getGuideHref(guide);
  const thumbUrl = pickGuidePreferredImageUrl(guide);
  const title = guide.title_override?.trim() || guide.title;
  const hasCategoryOrTags = guide.category || (guide.tags?.length ?? 0) > 0;
  const hasTaxonomyNames = guide.destination_name || guide.theme_name;
  const showMeta = variant === "default" && (hasCategoryOrTags || !!hasTaxonomyNames);

  /** h-full: 레일·그리드에서 행 높이 맞춤. min-h: 비율 그리드가 쓸 최소 카드 높이. */
  const wrapperClass = cn(
    CARD_LINK_CLASS,
    "h-full min-h-[240px] min-w-0 max-w-full sm:min-h-[260px]",
    className,
  );

  const inner = (
    <>
      <div className="relative min-h-0 w-full overflow-hidden bg-[var(--surface-muted)]">
        {thumbUrl ? (
          <Image
            src={thumbUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition duration-200 group-hover:scale-[1.02]"
            onError={(event) => {
              const img = event.currentTarget;
              if (img.src.endsWith(GUIDE_CARD_FALLBACK_IMAGE)) return;
              img.srcset = "";
              img.src = GUIDE_CARD_FALLBACK_IMAGE;
              img.style.objectFit = "contain";
              img.style.objectPosition = "center";
              img.style.backgroundColor = "#ffffff";
              img.style.padding = "8px";
            }}
          />
        ) : (
          <div className="flex h-full min-h-[5.5rem] items-center justify-center type-caption text-[var(--text-muted)]">
            가이드
          </div>
        )}
      </div>
      <div className="flex min-h-0 flex-col overflow-hidden p-4 sm:p-5">
        {showMeta ? (
          <div className="flex flex-wrap items-center gap-1.5 section-label text-[var(--text-muted)]">
            {guide.category ? (
              <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption">
                {guide.category}
              </span>
            ) : null}
            {guide.tags?.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption"
              >
                {tag}
              </span>
            ))}
            {!hasCategoryOrTags && guide.destination_name ? (
              <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption">
                {guide.destination_name}
              </span>
            ) : null}
            {!hasCategoryOrTags && guide.theme_name ? (
              <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption">
                {guide.theme_name}
              </span>
            ) : null}
          </div>
        ) : null}
        <h3 className="font-card-title mt-1 line-clamp-2 type-small font-semibold text-[var(--foreground)]">
          {title}
        </h3>
        {variant === "default" && guide.summary ? (
          <p className="mt-1 line-clamp-2 type-caption text-[var(--text-muted)]">
            {guide.summary}
          </p>
        ) : null}
        <span className="mt-auto inline-flex items-center pt-3 section-label text-[var(--primary)]">
          보기
          <span className="ml-1" aria-hidden>→</span>
        </span>
      </div>
    </>
  );

  return (
    <Link href={href} className={wrapperClass}>
      {inner}
    </Link>
  );
}
```

### 3.3 가이드 카드 그리드

파일: `src/components/guides/GuideCardGrid.tsx`

```tsx
import type { Guide } from "@/types/guide";
import { GuideCard } from "@/components/guides/GuideCard";

export type GuideCardGridProps = {
  guides: Guide[];
  className?: string;
  gridCols?: "2" | "3" | "4";
};

/** 가이드 카드 그리드. 홈/랜딩/가이드 상세 관련 가이드에서 사용 */
export function GuideCardGrid({
  guides,
  className,
  gridCols = "4",
}: GuideCardGridProps) {
  if (guides.length === 0) return null;
  const gridClass =
    gridCols === "2"
      ? "grid-cols-1 sm:grid-cols-2"
      : gridCols === "3"
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <ul
      className={`grid gap-4 ${gridClass} ${className ?? ""}`.trim()}
      aria-label="여행 가이드"
    >
      {guides.map((guide) => (
        <li key={guide.id} className="flex min-h-0 h-full min-w-0">
          <GuideCard guide={guide} className="w-full" />
        </li>
      ))}
    </ul>
  );
}
```

그리드 열 규칙:

| `gridCols` | Tailwind |
|------------|----------|
| `"2"` | `grid-cols-1 sm:grid-cols-2` |
| `"3"` | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |
| `"4"` (기본) | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` |

공통 gap: `grid gap-4`.

### 3.4 `/blog` 목록 카드 (`GuideCardList`)

파일: `src/components/guides/GuideCardList.tsx`

그리드: `flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-3`

카드 클래스:

```
flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-[#e2e8f0] transition hover:-translate-y-1 hover:shadow-lg
```

이미지 영역: `relative h-40 w-full overflow-hidden` + `object-cover`
본문: `flex flex-1 flex-col gap-3 p-5`
라벨: `section-label uppercase tracking-wide text-[#B8962E]` → `TRAVEL GUIDE`
제목: `font-card-title line-clamp-2 type-body font-semibold text-content-primary md:type-small`
요약: `line-clamp-4 type-small leading-6 text-content-secondary`
날짜: `type-caption text-content-muted`

전체 코드:

```tsx
"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Guide } from "@/types/guide";
import { GuidePdfModal } from "@/components/guides/GuidePdfModal";
import { GUIDE_CARD_FALLBACK_IMAGE, pickGuidePreferredImageUrl } from "@/lib/guides/imageUrl";

type GuideCardListProps = {
  guides: Guide[];
};

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR");
}

export function GuideCardList({ guides }: GuideCardListProps) {
  const [modalPdfUrl, setModalPdfUrl] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState<string>("");

  const openPdfModal = useCallback((pdfUrl: string, title: string) => {
    setModalPdfUrl(pdfUrl);
    setModalTitle(title);
  }, []);

  const closePdfModal = useCallback(() => {
    setModalPdfUrl(null);
    setModalTitle("");
  }, []);

  if (guides.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 type-small text-content-muted shadow-md ring-1 ring-[#e2e8f0]">
        아직 등록된 여행가이드가 없습니다.{" "}
        <Link
          href="/theall_manager_only/guides"
          className="font-medium text-[var(--primary)] underline hover:text-[var(--primary-hover)]"
        >
          관리자 페이지
        </Link>
        에서 가이드를 등록해 주세요.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {guides.map((guide) => {
          const thumbUrl = pickGuidePreferredImageUrl(guide);
          const pdfUrl = guide.guide_pdf_url ?? "";
          const hasPdf = Boolean(pdfUrl?.trim());
          const hasNotionDetail = Boolean(
            guide.slug?.trim() && guide.notion_page_id?.trim(),
          );
          const hasLanding = Boolean(guide.landing_url?.trim());
          const guideTitle = guide.title_override?.trim() || guide.title;

          const cardContent = (
            <>
              {thumbUrl ? (
                <div className="relative h-40 w-full overflow-hidden">
                  <Image
                    src={thumbUrl}
                    alt={guide.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 30vw"
                    className="object-cover"
                    onError={(event) => {
                      const img = event.currentTarget;
                      if (img.src.endsWith(GUIDE_CARD_FALLBACK_IMAGE)) return;
                      img.srcset = "";
                      img.src = GUIDE_CARD_FALLBACK_IMAGE;
                      img.style.objectFit = "contain";
                      img.style.objectPosition = "center";
                      img.style.backgroundColor = "#ffffff";
                      img.style.padding = "8px";
                    }}
                  />
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center bg-[#eff6ff] type-caption text-content-muted">
                  썸네일 이미지 없음
                </div>
              )}
              <div className="flex flex-1 flex-col gap-3 p-5">
                {(guide.category || (guide.tags?.length ?? 0) > 0 || guide.destination_name || guide.theme_name) ? (
                  <div className="flex flex-wrap items-center gap-1.5 section-label text-content-muted">
                    {guide.category ? (
                      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption">
                        {guide.category}
                      </span>
                    ) : null}
                    {guide.tags?.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption"
                      >
                        {tag}
                      </span>
                    ))}
                    {!guide.category && (guide.tags?.length ?? 0) === 0 && guide.destination_name ? (
                      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption">
                        {guide.destination_name}
                      </span>
                    ) : null}
                    {!guide.category && (guide.tags?.length ?? 0) === 0 && guide.theme_name ? (
                      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption">
                        {guide.theme_name}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <p className="section-label uppercase tracking-wide text-[#B8962E]">
                    TRAVEL GUIDE
                  </p>
                  <h2 className="font-card-title line-clamp-2 type-body font-semibold text-content-primary md:type-small">
                    {guideTitle}
                  </h2>
                </div>
                {guide.summary ? (
                  <p className="line-clamp-4 type-small leading-6 text-content-secondary">
                    {guide.summary}
                  </p>
                ) : null}
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <span className="type-caption text-content-muted">
                    {formatDate(guide.created_at)}
                  </span>
                </div>
              </div>
            </>
          );

          const cardClass =
            "flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-[#e2e8f0] transition hover:-translate-y-1 hover:shadow-lg";

          if (hasPdf) {
            return (
              <article
                key={guide.id}
                role="button"
                tabIndex={0}
                className={`${cardClass} cursor-pointer`}
                onClick={() => openPdfModal(pdfUrl, guideTitle)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openPdfModal(pdfUrl, guideTitle);
                  }
                }}
              >
                {cardContent}
              </article>
            );
          }

          if (hasNotionDetail && guide.slug?.trim()) {
            const s = guide.slug.trim();
            return (
              <Link key={guide.id} href={`/guides/${encodeURIComponent(s)}`} className={cardClass}>
                {cardContent}
              </Link>
            );
          }

          if (hasLanding) {
            return (
              <a
                key={guide.id}
                href={guide.landing_url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className={cardClass}
              >
                {cardContent}
              </a>
            );
          }

          return (
            <article key={guide.id} className={cardClass}>
              {cardContent}
            </article>
          );
        })}
      </div>

      <GuidePdfModal
        isOpen={Boolean(modalPdfUrl)}
        pdfUrl={modalPdfUrl ?? ""}
        title={modalTitle}
        onClose={closePdfModal}
      />
    </>
  );
}
```

### 3.5 `/guides` 목록 카드 (`GuidesListClient`)

파일: `src/components/guides/GuidesListClient.tsx`

카드 클래스:

```
group flex h-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-md ring-1 ring-[#e2e8f0] transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2
```

그리드는 `GuideCardList`와 동일: `flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-3`

```tsx
"use client";

import Link from "next/link";
import type { Guide } from "@/types/guide";
import { GUIDE_CARD_FALLBACK_IMAGE, pickGuidePreferredImageUrl } from "@/lib/guides/imageUrl";

export type GuideWithBadges = Guide & { badgeLabels: string[] };

type GuidesListClientProps = {
  guides: GuideWithBadges[];
};

function cardInner(guide: GuideWithBadges) {
  const thumbUrl = pickGuidePreferredImageUrl(guide);

  return (
    <>
      <div className="relative h-40 w-full overflow-hidden bg-slate-200">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={guide.title_override || guide.title}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
            onError={(event) => {
              const img = event.currentTarget;
              if (img.src.endsWith(GUIDE_CARD_FALLBACK_IMAGE)) return;
              img.src = GUIDE_CARD_FALLBACK_IMAGE;
              img.style.objectFit = "contain";
              img.style.objectPosition = "center";
              img.style.backgroundColor = "#ffffff";
              img.style.padding = "8px";
            }}
          />
        ) : null}
      </div>
      {guide.badgeLabels.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-0">
          {guide.badgeLabels.map((label) => (
            <span
              key={label}
              className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption text-[var(--text-muted)]"
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-2 p-4 pt-2">
        <p className="section-label text-content-muted">여행가이드</p>
        <h3 className="font-card-title type-h3 text-content-primary">
          {guide.title_override || guide.title}
        </h3>
        {guide.summary ? (
          <p className="type-caption leading-relaxed text-content-secondary">
            {guide.summary}
          </p>
        ) : null}
      </div>
    </>
  );
}

const CARD_CLASS =
  "group flex h-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-md ring-1 ring-[#e2e8f0] transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2";

export function GuidesListClient({ guides }: GuidesListClientProps) {
  if (guides.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 type-small text-content-muted shadow-md ring-1 ring-[#e2e8f0]">
        아직 등록된 여행가이드가 없습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
      {guides.map((guide) => {
        const slug = guide.slug?.trim();
        if (slug) {
          return (
            <Link
              key={guide.id}
              href={`/guides/${encodeURIComponent(slug)}`}
              className={CARD_CLASS}
            >
              {cardInner(guide)}
            </Link>
          );
        }
        return (
          <div key={guide.id} className={`${CARD_CLASS} cursor-not-allowed opacity-75`}>
            {cardInner(guide)}
            <p className="px-4 pb-3 text-xs text-slate-500">slug가 없어 페이지로 이동할 수 없습니다.</p>
          </div>
        );
      })}
    </div>
  );
}
```

### 3.6 RSS 카드 매핑 힌트

| RSS 필드 | 기존 카드 자리 |
|----------|----------------|
| `title` | `font-card-title` 제목 (`line-clamp-2`) |
| `description` / content snippet | `type-caption` 요약 (`line-clamp-2` 또는 `line-clamp-4`) |
| `pubDate` | `GuideCardList` 하단 `type-caption text-content-muted` 날짜 |
| `enclosure` / 첫 이미지 | 상단 썸네일 (`h-40` 또는 5:5 그리드) |
| `link` | 외부 `<a target="_blank" rel="noopener noreferrer">` (`GuideCardList`의 `hasLanding` 패턴) |
| 카테고리/출처 | `rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption` 배지 |

권장 페이지 셸: `/blog`·`/guides`와 동일하게 `SiteHeader activeTab="blog"` + `SectionBody max-w-6xl` + `PageHero size="sm"` + 2/3열 카드 그리드.

---

## 4. next.config.ts — images.remotePatterns

파일: `next.config.ts` (`.js` / `.mjs` 아님)

```ts
images: {
  formats: ["image/avif", "image/webp"],
  minimumCacheTTL: 86400,
  deviceSizes: [360, 375, 640, 768, 1024, 1280, 1536, 1920],
  imageSizes: [96, 128, 192, 256, 360, 384],
  remotePatterns: [
    { protocol: "https", hostname: "picsum.photos" },
    { protocol: "https", hostname: "images.unsplash.com" },
    { protocol: "https", hostname: "img.modetour.com" },
    { protocol: "https", hostname: "*.hanatour.com" },
    { protocol: "http",  hostname: "*.hanatour.com" },
    { protocol: "https", hostname: "static.hanatour.net" },
    { protocol: "https", hostname: "qmswixmwquuazrhfyils.supabase.co" },
    { protocol: "https", hostname: "images.kiwi.com" },
    { protocol: "https", hostname: "prod-files-secure.s3.us-west-2.amazonaws.com" },
    { protocol: "https", hostname: "s3.us-west-2.amazonaws.com" },
    { protocol: "https", hostname: "www.notion.so" },
    { protocol: "https", hostname: "notion.so" },
    { protocol: "https", hostname: "images.notion.so" },
    { protocol: "https", hostname: "file.notion.so" },
    { protocol: "https", hostname: "img.notionusercontent.com" },
    { protocol: "https", hostname: "quick-hen-cc9.notion.site" },
    { protocol: "https", hostname: "image-tc.galaxy.tf" },
    { protocol: "https", hostname: "*.googleusercontent.com" },
  ],
},
```

현재 허용 호스트 목록:

| hostname | protocol | 용도(추정) |
|----------|----------|------------|
| `picsum.photos` | https | 플레이스홀더 |
| `images.unsplash.com` | https | 스톡 이미지 |
| `img.modetour.com` | https | 모두투어 상품 이미지 |
| `*.hanatour.com` | https / http | 하나투어 상품 이미지 |
| `static.hanatour.net` | https | 하나투어 정적 자산 |
| `qmswixmwquuazrhfyils.supabase.co` | https | Supabase Storage |
| `images.kiwi.com` | https | 항공사 로고 등 |
| `prod-files-secure.s3.us-west-2.amazonaws.com` | https | 노션 파일 |
| `s3.us-west-2.amazonaws.com` | https | 노션/S3 |
| `www.notion.so` / `notion.so` | https | 노션 |
| `images.notion.so` / `file.notion.so` | https | 노션 이미지 |
| `img.notionusercontent.com` | https | 노션 콘텐츠 이미지 |
| `quick-hen-cc9.notion.site` | https | 노션 퍼블릭 사이트 |
| `image-tc.galaxy.tf` | https | 외부 이미지 |
| `*.googleusercontent.com` | https | Google Photos / Drive 썸네일 |

**네이버/티스토리 RSS 썸네일용으로 아직 없는 호스트 (연동 시 추가 후보):**

- `blogfiles.pstatic.net`
- `postfiles.pstatic.net`
- `ssl.pstatic.net`
- `*.pstatic.net`
- `blog.naver.com` / `m.blog.naver.com` (페이지 URL이지 이미지 CDN은 보통 pstatic)
- `t1.daumcdn.net`
- `k.kakaocdn.net`
- `img1.daumcdn.net`
- `*.tistory.com` / `tistory.com`

CSP (`next.config.ts` `contentSecurityPolicy`)의 `img-src`는 이미 `'self' data: blob: https:` 이므로, `next/image` remotePatterns만 추가하면 일반 HTTPS 썸네일은 표시 가능.

대안: `GuidesListClient`처럼 일반 `<img>`를 쓰면 remotePatterns 제약을 피할 수 있음 (최적화는 포기).

---

## 관련 파일 인덱스

| 구분 | 경로 |
|------|------|
| 홈 | `src/app/page.tsx` |
| 블로그 목록 | `src/app/blog/page.tsx` |
| 가이드 목록 | `src/app/guides/page.tsx` |
| 가이드 상세 | `src/app/guides/[slug]/page.tsx` |
| 루트 레이아웃 | `src/app/layout.tsx` |
| Next 설정 | `next.config.ts` |
| 의존성 | `package.json` |
| Card 프리미티브 | `src/components/ui/Card.tsx` |
| 가이드 카드 | `src/components/guides/GuideCard.tsx` |
| 가이드 그리드 | `src/components/guides/GuideCardGrid.tsx` |
| `/blog` 카드 목록 | `src/components/guides/GuideCardList.tsx` |
| `/guides` 카드 목록 | `src/components/guides/GuidesListClient.tsx` |
| 홈 가이드 레일 | `src/components/home/HomeGuideSection.tsx` |
| 페이지 컨테이너 | `src/components/layout/PageContainer.tsx` |
| 섹션 본문 | `src/components/layout/SectionBody.tsx` |
| 페이지 히어로 | `src/components/layout/PageHero.tsx` |
| 섹션 블록 | `src/components/layout/SectionBlock.tsx` |
