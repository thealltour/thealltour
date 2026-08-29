# 더올투어 UI/UX 고도화 사전 코드 조사

> **조사일:** 2026-08-26  
> **목적:** UI Design System / Header / Main / Product Discovery / Product Card / Product Detail / CTA / Mobile / A11y QA를 위한 실제 코드 기준 구조 파악  
> **범위:** 읽기 전용 조사·발췌. 코드 수정·PR·리팩터링 없음.

---

## A. UI 관련 파일 트리

```text
src/
  app/
    layout.tsx                 # RootLayout (Footer, ConsultModal, Kakao FAB)
    page.tsx                   # 홈 /
    globals.css                # 디자인 토큰·타이포·glass
    products/
      page.tsx                 # /products
      [id]/page.tsx            # /products/[id] → ProductDetailV2
      region/[slug]/page.tsx
      theme/[slug]/page.tsx
    search/page.tsx            # /search
    destinations/, themes/, recommended/
    quote/page.tsx
  components/
    site-chrome/
      SiteHeader.tsx / SiteHeaderUI.tsx
      GlobalSiteFooter.tsx
      KakaoFloatingButton.tsx
      MobileFloatingMenu.tsx   # 미사용 레거시
    header/
      MobileHeaderMenu.tsx / MobileHeaderDrawer.tsx
      DesktopMegaMenu.tsx / HeaderQuickConsultCtas.tsx
      HeaderExpandSearch.tsx / HeaderProductSearch.tsx
      HeaderMobileShell.tsx    # 미사용 레거시
    home/
      HeroSection.tsx / HomeHeroSearch.tsx / HomeDeferredSections.tsx
      GolfTourProductsSection / DestinationSection / ThemeSection
      CuratedProductsSection / HomeTrustSection / ...
    products/
      ProductCard.tsx          # 검색·연관·랜딩
      HomeProductCard.tsx      # 홈·골프 레일
      ProductListCard.tsx      # /products md+
      ProductListCardMobile.tsx
      ProductDetailV2.tsx      # ★ 운영 상세
      ProductDetailStickyV2.tsx
      ProductConsultCTA.tsx
      ProductsPageContent.tsx / ProductFilterSidebar.tsx
      MobileProductFilterDrawer.tsx / MobileProductSortSheet.tsx
    product-detail/
      ProductCatalogSection.tsx
      ProductDetailTabs.tsx    # ★ 미사용 레거시
      ProductsHero.tsx
    product/HomeProductCard.tsx  # re-export only
    search/ SearchFilters / SearchResults / SearchEmpty ...
    inquiry/ ConsultModal / HeroQuickConsultButton
    navigation/ Breadcrumb / NavigationContextHeader / MobileBackHeader
    layout/ PageContainer / SectionBlock / SectionHeader
    ui/ Button Card Badge Tabs Input Select Modal AlertCard ...
  lib/
    fonts.ts / productFilters.ts / productCardProps.ts / headerNavigation.ts
  brand/logo/
public/  (favicon, brand assets 등)
```

`tailwind.config.*` / `components.json`(shadcn) **없음** — Tailwind v4 `@import "tailwindcss"` + CSS 변수.

---

## B. 현재 페이지/컴포넌트 관계도

```text
RootLayout
  ConsultModalProvider
  children (페이지별 SiteHeader)
  KakaoFloatingButton (sm 미만, 상품상세 제외)
  GlobalSiteFooter

HOME (/)
  SiteHeader → SiteHeaderUI
    Desktop(lg+): MegaMenu + ExpandSearch + QuickConsultCtas
    Mobile: MobileHeaderMenu → Drawer
  HeroSection → HomeHeroSearch → HomeQuickKeywords
  HomeDeferredSections (dynamic + skeleton)
      → GolfTourProductsSection → HomeProductCardRail
      → GolfDepartureCalendarSection
      → DestinationSection / ThemeSection
      → CuratedProductsSection → HomeProductCard
      → HomeBlogSection / HomeReviewSection
  HomeTrustSection
  #contact → HeroQuickConsultButton

/products
  SiteHeader
  NavigationContextHeader (md+: Breadcrumb / md-: Back)
  ProductsHero
  ProductsPageContent
    lg+: ProductFilterSidebar
    ProductListToolbar → MobileFilterDrawer / SortSheet
    ProductCatalogSection
      md+: ProductListCard
      md-: ProductListCardMobile

/products/[id]  ★운영
  ProductDetailV2
  ProductReviewSection / ProductReviewsSection
  RelatedProductsSection → ProductCard (related)
  ProductDetailStickyV2Desktop (lg+)
  ProductDetailStickyV2Mobile (fixed bottom)

/search
  SearchResultsHeader + SearchFilters + SearchResults(ProductCard)
```

**의미 탭 구조 (상세 내장):** 일정 안내 · 포함/불포함 · 예약 조건 · 여행 시 유의사항 · 환불/취소 규정  
→ `ProductDetailV2` 인라인. `ProductDetailTabs`는 import 0건(레거시).

---

## C. Header / Navigation 코드

### 컴포넌트 계층

```text
SiteHeader (RSC)
└── SiteHeaderUI ("use client")
    ├── GuestSignupPromoBanner
    ├── [lg+] PageContainer
    │   ├── 유틸 네비 (회사소개·견적·후기·가이드·블로그·고객센터)
    │   └── 메인 바
    │       ├── HeaderBrandLogo
    │       ├── DesktopMegaMenu → DesktopMegaMenuPanel
    │       ├── HeaderExpandSearch
    │       ├── UserMenuDropdown | GuestAuthHoverMenu
    │       └── HeaderQuickConsultCtas
    └── [lg 미만] MobileHeaderMenu
        ├── 햄버거 | 로고 | 「문의하기」
        ├── (옵션) HeaderProductSearch 행
        └── MobileHeaderDrawer → MobileHeaderAccordion

페이지 컨텍스트 (상품 등)
NavigationContextHeader
├── [md+] Breadcrumb (+ endAction)
└── [md 미만] MobileBackHeader
```

**미사용(레거시):** `HeaderMobileShell`, `MobileFloatingMenu` — 다른 파일에서 import 없음.

### Sticky 헤더

**있음.** `SiteHeaderUI` 최외곽: `sticky top-[env(safe-area-inset-top)] z-50 lg:z-40`

### Desktop vs Mobile (`lg` 기준)

| | Desktop (`lg:`+) | Mobile (`lg:hidden`) |
|--|--|--|
| 레이아웃 | 유틸바 + 메인바 | `MobileHeaderMenu` 2단 스택 |
| 1차 내비 | `DesktopMegaMenu` | 햄버거 → 풀스크린 드로어 |
| 검색 | `HeaderExpandSearch` | 홈(`/`)은 검색행 숨김; 그 외 `HeaderProductSearch` |
| CTA | 「상담 문의」+「카톡 상담」 | 「문의하기」→ ConsultModal |

### Root Layout (헤더는 페이지별 마운트)

```tsx
// src/app/layout.tsx (발췌)
<body className="site-public flex min-h-screen flex-col bg-background text-foreground antialiased ...">
  <SiteToastProvider>
    <ConsultModalProvider>
      <AuthProvidersShell>
        <div className="flex-1">{children}</div>
        <KakaoFloatingButton />
        <GlobalSiteFooter />
      </AuthProvidersShell>
    </ConsultModalProvider>
  </SiteToastProvider>
</body>
```

### SiteHeader → SiteHeaderUI

```tsx
// src/components/site-chrome/SiteHeader.tsx
export default async function SiteHeader({
  activeTab,
  searchQuery,
  golfPresetActive = false,
  quickConsultHref,
  kakaoConsultHref,
}: SiteHeaderProps) {
  // session + memberPoints + getHeaderNavigationData()
  return (
    <SiteHeaderUI
      headerNavigationData={headerNavigationData}
      activeTab={activeTab}
      searchQuery={searchQuery}
      golfPresetActive={golfPresetActive}
      quickConsultHref={quickConsultHref}
      kakaoConsultHref={kakaoConsultHref}
      session={session ? { name: session.name } : null}
      memberPoints={memberPoints}
    />
  );
}
```

```tsx
// src/components/site-chrome/SiteHeaderUI.tsx (구조 발췌)
return (
  <div className="sticky top-[env(safe-area-inset-top)] z-50 lg:z-40">
    <GuestSignupPromoBanner isLoggedIn={Boolean(session)} />
    <header className="glass-chrome border-b border-[var(--divider)] ... safe-top">
      <PageContainer size="wide" className="hidden flex-col py-0 lg:flex">
        {/* 유틸바: about/quote/reviews/guides?/blog/support */}
        <div className="header-main-bar--desktop flex items-center gap-x-5 lg:gap-x-6 xl:gap-x-7">
          <Link href="/" aria-label="더올투어 홈">
            <HeaderBrandLogo variant="desktop" priority />
          </Link>
          <DesktopMegaMenu primaryNav={primaryNav} />
          <div className="flex flex-1 justify-end items-center gap-x-4">
            <HeaderExpandSearch searchQuery={searchQuery} />
            {session ? <UserMenuDropdown ... /> : <GuestAuthHoverMenu />}
            <HeaderQuickConsultCtas ... />
          </div>
        </div>
      </PageContainer>
      <MobileHeaderMenu
        primaryNav={primaryNav}
        showHeaderSearchRow={!isHomePath}  // pathname === "/" 이면 false
        ...
      />
    </header>
  </div>
);
```

### Mobile Navigation

```tsx
// src/components/header/MobileHeaderMenu.tsx (구조 발췌)
<div className="mobile-header-stack lg:hidden">
  <div className="mobile-header-top-bar mx-auto max-w-6xl">
    <button type="button" aria-label="메뉴 열기" onClick={openDrawerWithTrack}>…</button>
    <Link href="/" aria-label="더올투어 홈">…</Link>
    <button type="button" onClick={handleConsultClick}
      className="mobile-header-top-bar__cta glass-cta-edge ...">
      문의하기
    </button>
  </div>
  {showHeaderSearchRow ? (
    <div className="mobile-header-search-row ...">
      <HeaderProductSearch mode="mobile" headerBar />
    </div>
  ) : null}
</div>
<MobileHeaderDrawer ... />
```

### PageContainer / NavigationContextHeader

```tsx
// src/components/layout/PageContainer.tsx
// size: reading 1040 | default 1280 | wide 1600 | full
export function PageContainer({ children, size = "default", className }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full", "px-4 sm:px-6 lg:px-8 xl:px-10", SIZE_CLASS[size], className)}>
      {children}
    </div>
  );
}
```

```tsx
// src/components/navigation/NavigationContextHeader.tsx
// 데스크톱: Breadcrumb / 모바일: MobileBackHeader
// showProductsNavigationContext(pathname)일 때만 렌더
<div className="hidden md:flex md:items-center md:justify-between md:gap-4">
  <Breadcrumb items={items} ... />
  {endAction ? <div className="hidden shrink-0 md:inline-flex">{endAction}</div> : null}
</div>
<MobileBackHeader title={pageTitle} fallbackHref={fallbackHref} />
```

### 관련 파일 목록

| Path | Export | 비고 |
|------|--------|------|
| `src/components/site-chrome/SiteHeader.tsx` | default `SiteHeader` | RSC |
| `src/components/site-chrome/SiteHeaderUI.tsx` | default `SiteHeaderUI` | sticky + lg 분기 |
| `src/components/header/MobileHeaderMenu.tsx` | `MobileHeaderMenu` | 활성 모바일 헤더 |
| `src/components/header/MobileHeaderDrawer.tsx` | `MobileHeaderDrawer` | portal z-[70] |
| `src/components/header/DesktopMegaMenu.tsx` | `DesktopMegaMenu` | |
| `src/components/header/HeaderQuickConsultCtas.tsx` | default | 상담+카톡 |
| `src/components/site-chrome/GlobalSiteFooter.tsx` | default | |
| `src/components/site-chrome/KakaoFloatingButton.tsx` | default | sm:hidden |
| `src/components/header/HeaderMobileShell.tsx` | — | **미사용** |
| `src/components/site-chrome/MobileFloatingMenu.tsx` | — | **미사용** |

```text
[생략]
파일: DesktopMegaMenu.tsx, MobileHeaderDrawer.tsx, GlobalSiteFooter.tsx, HeaderQuickConsultCtas.tsx 전체
생략 이유: 계층·CTA·반응형 핵심은 위에 포함. 메가메뉴 패널·푸터 채널 목록은 네비 데이터 중심
UI/UX 분석에 필요한 핵심 부분은 위에 포함됨
```

---

## D. Main 코드

```text
page.tsx
  → SiteHeader
  → HeroSection (배너/검색/키워드)
  → HomeDeferredSections (dynamic + skeleton)
      → GolfTourProductsSection → HomeProductCardRail
      → GolfDepartureCalendarSection
      → DestinationSection / ThemeSection
      → CuratedProductsSection → HomeProductCard
      → HomeBlogSection / HomeReviewSection
  → HomeTrustSection
  → #contact → HeroQuickConsultButton
```

```tsx
// src/app/page.tsx (구조 발췌)
return (
  <>
    <SiteHeader />
    <div className="min-h-screen bg-[var(--theall-page-bg)] ...">
      <main className="flex w-full ... flex-col pb-6 sm:pb-10 md:pb-14">
        <HeroSection heroBanners={topBanners} hero={hero} />
        <PageContainer size="wide" className="flex flex-col max-md:gap-5 ... md:gap-10 ...">
          <HomeDeferredSections ... />
          <HomeTrustSection tourismRegNo={settings.tourism_reg_no} />
          <SectionBlock id="contact" ...>
            ...
            <HeroQuickConsultButton />
          </SectionBlock>
        </PageContainer>
      </main>
    </div>
  </>
);
```

### Hero

- **모바일 &lt;md:** 텍스트 + 검색 허브 (배너 배경 없음)
- **md+:** 파노라마 `max-w-[1600px]` + `rounded-2xl/3xl`, `heroBanners` fade 슬라이드

```tsx
// src/components/home/HeroSection.tsx (주석·구조)
/**
 * 모바일(<md): 배너 배경 없음 — 텍스트 + 검색 + 빠른 선택 허브.
 * md+: 파노라마 배경 — heroBanners fade 슬라이드
 * 태블릿(md~lg-1): mobile_image_url ?? image_url, 데스크톱(lg+): image_url
 */
<section className={cn("relative w-full", "md:mx-auto md:max-w-[1600px] md:px-6 lg:px-8 xl:px-10", ...)}>
  <div className={cn("relative bg-[var(--hero-bg)]", "md:rounded-2xl lg:rounded-3xl")}>
```

### HomeDeferredSections

`next/dynamic` + 로컬 `SectionSkeleton` / `ExploreRailSkeleton` (`animate-pulse`, `rounded-2xl`).

빈 데이터: Destination/Theme/GolfTour → `return null`; Curated만 관리자 안내 empty 카피.

---

## E. Product List / Search / Filter 코드

### `/products` (`src/app/products/page.tsx`)

조립: `SiteHeader` → `NavigationContextHeader` → `ProductsHero` → `ProductsPageContent` (또는 empty section).

### 필터·정렬 구현 여부

| 구현됨 | 미구현 |
|--------|--------|
| 키워드 `q`, 지역/테마 트리, product_line, collection(추천/인기/신규) | 가격 범위 슬라이더 |
| 정렬: 추천/가격/최신/신규/인기 | 출발일·여행기간 필터 |
| 데스크톱 sticky 사이드바 (`hidden lg:block`) | infinite scroll / 페이지네이션 |
| 모바일 Filter Drawer + Sort Sheet | 국가/도시 독립 필터(지역 트리에 종속) |

```ts
// src/lib/productFilters.ts
export type ProductFiltersState = {
  region: string | null;
  theme: string | null;
  product_line: string | null;
  sort: ProductSortId;
  q: string | null;
  collection: string | null;
};

export const SORT_OPTIONS = [
  { value: "recommended", label: "추천순" },
  { value: "price_asc", label: "가격 낮은순" },
  { value: "price_desc", label: "가격 높은순" },
  { value: "latest", label: "최신순" },
  { value: "new", label: "신규순" },
  { value: "popular", label: "인기순" },
];
```

```tsx
// src/components/products/ProductsPageContent.tsx (구조)
<div className="flex w-full max-w-full items-start gap-8">
  <ProductFilterSidebar ... />  {/* className: hidden w-72 ... lg:block */}
  <div className="min-w-0 flex-1 space-y-4">
    <ProductListToolbar
      onFilterClick={() => setFilterDrawerOpen(true)}
      onSortClick={() => setSortSheetOpen(true)}
      ...
    />
    <ProductFilterChips ... />
    <ProductCatalogSection products={filteredProducts} ... />
  </div>
</div>
<MobileProductFilterDrawer ... />
<MobileProductSortSheet ... />
```

목록 카드: `ProductCatalogSection`에서 `md` 분기 → `ProductListCard` / `ProductListCardMobile`.  
**필터된 전체 목록 일괄 렌더(페이지네이션 없음).**

### `/search` (`src/app/search/page.tsx`)

```text
q + destination + theme + product_line + sort + page
→ SearchFilters (select), SearchResultsContainer (다페이지 시), SearchEmpty
```

```tsx
// src/components/search/SearchFilters.tsx (발췌)
<div className="flex flex-wrap items-center gap-3 rounded-xl border ... px-4 py-3">
  <span className="text-[11px] font-semibold ...">필터</span>
  <label htmlFor="search-filter-destination" className="sr-only">지역</label>
  <select id="search-filter-destination" ...>지역 전체</select>
  <select id="search-filter-theme" ...>테마 전체</select>
  {/* product_line select */}
</div>
```

### 관련 라우트

- `/products`, `/products/region/[slug]`, `/products/theme/[slug]`
- `/destinations`, `/destinations/[slug]`
- `/themes`, `/themes/[slug]`
- `/recommended`, `/recommended/[slug]`
- `/search`

---

## F. Product Card 코드

### 중복 존재: **예 (의도적으로 3+ 계열)**

| 카드 | 파일 | 사용 위치 | 표시 | 이미지 비율 |
|------|------|-----------|------|-------------|
| **ProductCard** | `products/ProductCard.tsx` | 검색, Related, 랜딩, 가이드 | 이미지·배지·제목·oneLiner·기간·가격·태그·평점·옵션 CTA | related=`aspect-[4/3]`; grid/list=가로 split |
| **HomeProductCard** | `products/HomeProductCard.tsx` | 홈 큐레이션·골프 레일 | 배지·지역·제목·가격 (상담 CTA 없음, 링크만) | grid=`aspect-video`→`sm:aspect-[4/3]`; rail=`4/3` |
| **ProductListCard** | 동일 props | `/products` md+ | 가로 3열 그리드 + **상담 CTA** | ~280px 고정폭 |
| **ProductListCardMobile** | 동일 props | `/products` md- | 좌 이미지 34% + CTA | min-h 148px |
| `product/HomeProductCard` | re-export | 경로 호환 | — | — |

### ProductCard props (핵심)

```ts
// src/components/products/ProductCard.tsx
export type ProductCardLayout = "grid" | "list" | "related" | "stack";
// stack 타입은 있으나 호출처 없음
// 필드: title, price, duration, region, badges, infoBadges, thumbnailUrl,
// hrefDetail, onClickConsult, oneLiner, ratingAvg, seasonal_price_bands, highlightTag, ...
```

### HomeProductCard

```tsx
// src/components/products/HomeProductCard.tsx (발췌)
<Link href={resolvedHref} aria-label={`${titleText}, 상세 보기`}
  className={cn("... rounded-xl ... sm:rounded-2xl", ...)}>
  <div className={cn("relative w-full ...",
    variant === "rail" ? "aspect-[4/3]" : "aspect-video sm:aspect-[4/3]")}>
    <Image src={imageSrc} alt={titleText} fill className="object-cover ..." />
  </div>
  {/* 배지 → 칩 → 지역 → 제목 → pitch/oneLiner(sm+) → 가격 */}
</Link>
```

placeholder: `https://picsum.photos/seed/thealltour-home-card/800/600` (이미지 없을 때).

### ProductCardGridSection

- 기본 모바일: `min-w-[78%]` 가로 스크롤 → `sm+` 2열 → `lg` 2~4열
- `homeCuratedMobileCompact`: 모바일 `grid-cols-2` (스크롤 없음)
- `hubLandingLayout`: md 미만 스냅 레일

### CTA on cards

- **목록 카드:** `ProductCatalogSection`이 `onClickConsult` 전달 → 상세 외 상담 가능
- **홈 카드:** 상세 링크만 (카드 내 상담 버튼 없음)
- **ProductCard related:** `onClickConsult` 옵션

```text
[생략]
파일: ProductListCard.tsx / ProductListCardMobile.tsx / ProductCard.tsx 전체 JSX
생략 이유: ProductCardProps 공유 + 레이아웃만 상이. 표시 필드·CTA 패턴은 표와 CatalogSection 참조로 충분
UI/UX 분석에 필요한 핵심 부분은 위에 포함됨
```

---

## G. Product Detail 코드

### 운영 컴포넌트: **`ProductDetailV2`**

`ProductDetailTabs`는 **앱 코드 import 0건** → 레거시·미사용.  
`TravelOverviewV2`도 컴포넌트 import 0건.

```text
/products/[id]/page.tsx
  ConsultModalProvider
  └── ProductQuoteProvider
      ├── SiteHeader
      └── PageContainer
          ├── NavigationContextHeader
          └── flex (lg: main + sticky aside)
             ├── main
             │  ├── ProductDetailV2          ← 본문 전부
             │  ├── ProductReviewSection
             │  ├── ProductReviewsSection
             │  ├── RelatedProductsSection   ← ProductCard grid
             │  ├── GuideCard 그리드 (있을 때)
             │  └── AlertCard
             ├── ProductDetailStickyV2Desktop  (aside, hidden lg:flex sticky)
             └── ProductDetailStickyV2Mobile   (fixed bottom, lg:hidden)
```

```tsx
// src/app/products/[id]/page.tsx (발췌)
<ProductDetailV2
  title={product.title}
  ...
  bookingNotes={resolvedBookingNotes}
  travelNotes={resolvedTravelNotes}
  bookingConditions={resolvedBookingConditions}
  refundPolicy={resolvedRefundPolicy}
  consultHref={`/quote?product_id=...`}
  ...
/>
```

### 영역별 구현 위치

| 영역 | 구현 위치 |
|------|-----------|
| Breadcrumb | `NavigationContextHeader` |
| 상품명 / Hero / Gallery | `ProductDetailV2` + `ProductImageCarousel` |
| 가격·기간·항공·최소인원·특징 | Price Card + `ProductSummaryInfo` / Flight / Highlights |
| 일정·포함·예약·유의·환불 | **Tabs** in `ProductDetailV2` |
| 상담 CTA | StickyV2 + `ProductConsultCTA` / CheckoutRail |
| 관련 상품 | `RelatedProductsSection` (`products/`) |

### ProductDetailV2 섹션 순서

1. TagRow (상태·지역·카테고리)
2. h1 제목 + 리뷰 링크 + oneLiner
3. Price Summary Card (+ 키워드/테마 차트)
4. `ProductImageCarousel`
5. `ProductSummaryInfo` / Description / SellingPoints / Package
6. 모바일: badges / `ProductTrustSummary` / `ProductQuickInfoBar`
7. Highlights / QuickSummary / TrustSignals
8. Itinerary preview / Feature / Flight / Hotel
9. **Tabs (5종)**

```tsx
// src/components/products/ProductDetailV2.tsx
type MainTab = "schedule" | "included" | "booking" | "travel" | "refund";

<Tabs value={activeTab} onChange={(v) => setActiveTab(v as MainTab)} className="mb-4 gap-2">
  <TabsTrigger value="schedule">일정 안내</TabsTrigger>
  <TabsTrigger value="included">포함/불포함</TabsTrigger>
  <TabsTrigger value="booking">예약 조건</TabsTrigger>
  <TabsTrigger value="travel">여행 시 유의사항</TabsTrigger>
  <TabsTrigger value="refund">환불/취소 규정</TabsTrigger>
</Tabs>
```

### Tabs 모바일 동작

`src/components/ui/Tabs.tsx` = **`flex-wrap`** (horizontal scroll / dropdown 아님).

```tsx
<div className={cn(
  "flex w-full max-w-full flex-wrap items-center gap-1 rounded-full bg-[var(--surface-muted)] p-1",
  className,
)}>
```

### Sticky CTA

- **Desktop (`lg+`):** `aside.sticky` `top: 120px`, 예상가 + 예약 패널 + checkout rail
- **Mobile (`lg:hidden`):** `fixed` bottom + `visualViewport` offset + safe-area
- 본문: `pb-[calc(8.5rem+env(safe-area-inset-bottom))]` — CTA 가림 방지

```tsx
// ProductDetailStickyV2Mobile
<div role="banner" aria-label="상품 예약 상담"
  className="fixed left-0 right-0 z-50 ... glass-chrome glass-chrome-bottom lg:hidden"
  style={{ bottom: "var(--mobile-cta-viewport-offset, 0px)", ... }}>
```

```text
[생략]
파일: ProductDetailV2.tsx 중반 비즈니스 파싱·탭 패널 본문 전체 (~1000줄+)
생략 이유: 섹션 순서·탭 5종·갤러리 조립은 위에 포함. TravelOverviewV2는 마운트되지 않음
UI/UX 분석에 필요한 핵심 부분은 위에 포함됨
```

---

## H. CTA / Inquiry 코드

| 위치 | Desktop | Mobile |
|------|---------|--------|
| Header | 상담 문의 + 카톡 (`HeaderQuickConsultCtas`) | 문의하기 1개 (`MobileHeaderMenu`) |
| 홈 contact | `HeroQuickConsultButton` (독립 모달, **primary**) | 동일 |
| 전역 | `ConsultModal` (**accent** 제출) | 동일 |
| FAB | — | `KakaoFloatingButton` (`sm:hidden`, 상품상세·admin·일부 golf 제외) |
| 상품 목록 카드 | `onClickConsult` CTA | 동일 |
| 상품 상세 | Sticky aside | **Sticky bottom CTA 있음** |
| 홈 카드 | 상세만 | 상세만 |

### 주요 파일

- `src/components/inquiry/ConsultModal.tsx` — Provider + glass modal
- `src/components/inquiry/HeroQuickConsultButton.tsx` — 홈 전용 독립 모달
- `src/components/products/ProductConsultCTA.tsx` — section=`top|sticky|itinerary`
- `src/components/header/HeaderQuickConsultCtas.tsx`
- `src/components/site-chrome/KakaoFloatingButton.tsx`
- `src/lib/products/getProductCtaLabel.ts` / `productDetailCta.ts`

**감사 포인트:** 검색·히어로 빠른상담 = primary(블루), ConsultModal 제출 = accent(오렌지). 홈에서 두 상담 UI 공존.

---

## I. Design System / 공통 UI 코드

**커스텀 DS (shadcn 아님).** `components.json` 없음.

### `src/components/ui/`

| 컴포넌트 | 역할 |
|----------|------|
| Button | primary/accent/secondary/kakao/ghost/outline, `rounded-xl`, h 36/44/52 |
| Card | default/elevated/interactive=`rounded-2xl`, hero=`rounded-3xl` |
| Badge, Tag | |
| Tabs / TabsTrigger | wrap pill tabs |
| Input, Select, Textarea, Label, FormField | |
| Modal, Lightbox | |
| AlertCard | |
| FilterChip, SortDropdown | |
| DatePicker, DateRangePicker, TheallDayPicker | |
| ActionPromptToast, Icon | |

공용 Skeleton 컴포넌트 **없음** — 페이지별 `animate-pulse`.

### layout

`PageContainer`, `SectionBlock`, `SectionHeader`, `SectionBody`, `Surface`, `ContentCard`, `InlineGrid`

```tsx
// Button 핵심
/** 높이: sm 36px, md 44px, lg 52px. radius 12px. focus-visible ring 3px --focus-ring. */
const base =
  "inline-flex items-center justify-center rounded-xl type-btn transition-all duration-150 " +
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] ...";
// accent → --accent, primary → --primary, kakao → --theall-kakao-*
```

---

## J. CSS / Tailwind / Theme 코드

### 토큰 계층 (`src/app/globals.css`)

```text
Layer 1 — Brand primitives: --theall-*
Layer 2 — Semantic: --primary, --accent, --surface*, --text-*, --border*
Layer 3 — Domain: --hero-*, --header-*, --mobile-header-*, --products-mobile-*
Legacy admin aliases: --background, --brand, --muted 등
```

### 브랜드 컬러

```css
:root {
  --theall-brand-blue: #1e5b8f;
  --theall-brand-orange: #e0612a;   /* 주의: #FF7A2F 아님 */
  --primary: var(--theall-brand-blue);
  --accent: var(--theall-brand-orange);
  --shadow-soft: 0 6px 18px rgba(11, 18, 32, 0.06);
  --shadow-soft-strong: 0 10px 28px rgba(11, 18, 32, 0.12);
  /* spacing: --space-1..7 = 4/8/12/16/24/56/64 */
}
```

| 브랜드 기준 | 실제 코드 |
|-------------|-----------|
| Primary `#1E5B8F` | ✅ `--theall-brand-blue` → `--primary` |
| Accent `#FF7A2F` | ❌ **미사용**. 실제 **`#e0612a`** |

사용 방식: 공개 UI는 대부분 `var(--primary)` / `var(--accent)`.  
하드코딩 분산: 상세 h1 `text-[#0f172a]`, `text-slate-*` 다수, OG/스마트스토어에 hex 소수.

**`--radius` CSS 변수 없음** → Tailwind `rounded-lg/xl/2xl/3xl/full` 혼재.

### Typography

- Font: Pretendard Variable (`src/lib/fonts.ts` → `--font-pretendard`)
- 스택: `--font-sans-fallback`, `--font-display-sans` (Wanted Sans Variable 폴백 포함)
- 유틸: `.type-h1`~`.type-caption`, `.type-btn`, `.heading-display`, `.font-card-title`, `.font-price-strong`
- 스케일: h1 42px / h2 30px / h3 24px / body ~20.4px (중장년 가독성 주석)

**판정:** 공통 시스템(유틸+토큰) 있으나, 많은 컴포넌트가 Tailwind `text-2xl` / `text-sm` / `text-slate-*`를 **개별 지정**.

### Spacing / Radius / Shadow 패턴

- Card/Section: `rounded-2xl` / `sm:rounded-3xl` 흔함
- Button: `rounded-xl` (12px)
- Search CTA / chips: `rounded-full`
- HomeProductCard: `rounded-xl` → `sm:rounded-2xl`
- Shadow: `--shadow-soft` / `--shadow-soft-strong` / Tailwind `shadow-md` 혼용

이후 `4/8/12/16/24/32/48` spacing · `8/12/16` radius 체계화 가능하나, 현재는 토큰·클래스 혼재.

---

## K. Mobile / Responsive 관련 코드

| Breakpoint | 주요 용도 |
|------------|-----------|
| `sm` | 홈 카드 비율·타이포, Kakao FAB 숨김 (`sm:hidden` = 모바일만 FAB) |
| `md` | Hero 파노라마, Breadcrumb vs Back, ListCard 분기 |
| `lg` | Header desktop/mobile, Filter sidebar, Detail sticky split |
| `xl` | 헤더 gap, 상세 gap |

### 화면별

| 화면 | 모바일 동작 |
|------|-------------|
| Header | `lg` 분기: 햄버거 드로어 + 문의하기. 홈만 검색행 숨김 |
| Main | 큐레이션 `grid-cols-2`; 그 외 카드 레일 `min-w-[78%]` |
| Product List | 사이드바 `lg+`; 모바일 Drawer/Sheet |
| Product Detail | 본문 full + bottom sticky; `lg+` aside |
| Tabs | **wrap** (scroll/dropdown 아님) |
| Sticky CTA | 상세 모바일 **있음** |

모바일 전용 CSS 클래스: `mobile-header-stack`, `mobile-header-top-bar`, `mobile-header-search-row`, `glass-chrome`, `glass-cta-edge` (globals.css).

---

## L. 중복 컴포넌트 분석

```text
A ProductCard          파일: products/ProductCard.tsx
  사용: 검색/연관/랜딩/가이드
B HomeProductCard      파일: products/HomeProductCard.tsx
  사용: 홈/골프 레일
C ProductListCard(+Mobile)
  사용: /products만
차이: 레이아웃·밀도·CTA·aspect 상이, props/배지 로직은 공유(lib/productCardProps)
통합 가능성: 중간 (프리셋 variant로 통합 가능하나 리스크 큼)

A ProductDetailV2      /products/[id] 운영
B ProductDetailTabs    import 0 — 레거시
통합: 낮음(삭제 후보). 탭 UI는 V2에 이미 흡수

A SiteHeader/SiteHeaderUI
B HeaderMobileShell / MobileFloatingMenu — 미사용
통합: 낮음(정리 대상)

A ConsultModal (accent)
B HeroQuickConsultButton (primary, 별도 모달)
차이: 필드·색·analytics
통합 가능성: 높음

A products/RelatedProductsSection
B search/RelatedProductsSection
C ProductRelatedProducts (미사용)
통합 가능성: 높음

A TravelOverviewV2 — 마운트 0
```

---

## M. 현재 User Journey

```text
HOME (Hero검색 / 골프·지역·테마·큐레이션)
  ↓ 검색 → /search 또는 /products?q=
  ↓ 레일/카드 → /products/[id] 또는 /destinations|/themes|/products?tourType=
상품 목록 (/products + 필터)
  ↓ ListCard CTA(상담) 또는 상세
상품 상세 (V2 + Sticky CTA)
  ↓ ConsultModal / 카카오 / quote / (PortOne 예약)
문의·견적
```

### Journey Q&A (코드 기준)

1. **메인에서 여행 발견:** Hero 검색·키워드·큐레이션·골프 달력으로 가능. 모바일 Hero는 배너 없이 검색 중심.
2. **상품 간 비교:** 목록 카드 정보량 양호하나 비교 전용 UI 없음.
3. **상세 핵심 조건 파악:** 가격카드+Summary+QuickInfo로 상단 집중. 이후 섹션·탭 정보량 많음.
4. **상담/문의 CTA:** 헤더/스티키/카드에 명확. 색상(primary vs accent)은 이중.
5. **모바일 CTA 접근성:** 상세 Sticky 양호; 전역 Kakao FAB는 상세에서 숨김.
6. **상세 정보 복잡도:** QuickSummary + Highlights + Feature + Tabs 중복 후보.
7. **신뢰 형성:** `HomeTrustSection`, 리뷰, tourism_reg, `TrustSignals` 존재.

---

## N. UI/UX 문제 후보

### P0

- (코드상 즉시 예약 차단 수준의 결함은 스티키 CTA·모달이 있어 **명확한 P0는 제한적**. 다만) **상품 `not-found.tsx` / 루트 `not-found` 부재** — `notFound()`만 호출, guides만 전용 UI → 404 UX 공백.

### P1

- **Product Card 3계열 분기** → 시각·CTA·비율 불일치로 탐색 신뢰↓ (`ProductCard` vs `Home*` vs `List*`).
- **`/products` 페이지네이션 없음** — 필터 후 전체 렌더 → 모바일 성능·스캔 비용.
- **검색/필터 이중 경로** (`/search` select vs `/products` 트리) — 기간·출발일·가격대 필터 부재.
- **상세 정보 중복/과다** (QuickSummary + Highlights + Feature + Tabs) + Tabs wrap으로 모바일 탭 높이 증가.
- **상담 CTA 이중 구현** (`ConsultModal` accent vs `HeroQuickConsultButton` primary).

### P2

- 브랜드 오렌지 **문서 `#FF7A2F` vs 코드 `#e0612a`** 불일치.
- 하드코딩 `slate`/`#0f172a` vs 토큰 혼용 (`ProductDetailV2` h1 등).
- radius·shadow 토큰 없이 `rounded-xl|2xl|3xl` 혼재.
- 미사용 레거시: `ProductDetailTabs`, `TravelOverviewV2`, `HeaderMobileShell`, `MobileFloatingMenu`.
- RelatedProductsSection 이중 파일.

### P3

- HomeProductCard `picsum` placeholder.
- Button `rounded-xl` vs 검색 pill `rounded-full` 등 polish.
- 헤더 데스크톱 `quickConsultHref`/`tel` 미연결(코드상 prop 정의만, 버튼 미연결).

---

## O. 추천 PR 분리

실제 구조 반영안:

```text
PR-UI-00  레거시 정리(읽기 전용 맵핑 후 삭제 후보)
          ProductDetailTabs / TravelOverviewV2 / HeaderMobileShell / MobileFloatingMenu
          RelatedProducts 통합 — 동작 변경 최소

PR-UI-01  Design System Foundation
          radius/spacing 토큰, slate→semantic, accent hex 문서 정합(#e0612a 확정)

PR-UI-02  Header / Navigation
          CTA 단일화(ConsultModal), 모바일 검색행 정책 정리

PR-UI-03  Main Page
          Hero·섹션 밀도·Trust·contact CTA 정렬

PR-UI-04  Product Discovery / Search / Filter
          /products·/search 필터 모델 정렬, (선택) 페이지네이션

PR-UI-05  Product Card Unification
          variant 프리셋으로 List/Home/Related 시각 계약 통합

PR-UI-06  Product Detail Information Architecture
          상단 스캔 블록 정리 + Tabs(모바일 scroll) + Sticky 유지

PR-UI-07  CTA / Inquiry UX
          ConsultModal 단일 진입, 카드/스티키 라벨 통일

PR-UI-08  Mobile UX
          목록 Drawer, 상세 tabs, safe-area, FAB vs Sticky 충돌

PR-UI-09  Loading / Empty / Error
          not-found, SearchEmpty 확장, 공통 Skeleton

PR-UI-10  Accessibility / Responsive / Final QA
```

**권장 순서:** 00 → 01 → 05 → 06 → 07 → 04 → 03 → 02 → 08 → 09 → 10  
(카드·상세·CTA가 전환에 직접 영향; DS는 이후 PR 비용을 낮춤)

---

## 부가 조사: Loading / Empty / Error / Image / A11y

### Loading / Empty / Error

| 영역 | 패턴 |
|------|------|
| 홈 deferred | local `SectionSkeleton` (`animate-pulse`) |
| 공용 Skeleton | 없음 |
| 검색 empty | `SearchEmpty.tsx` |
| `/products` empty | 페이지 인라인 “등록된 상품이 없습니다” |
| `products/[id]/not-found.tsx` | **없음** |
| 앱 루트 `not-found.tsx` | **없음** (guides만 전용) |

### 이미지

- `next/image` 사용 (ProductCard, HomeProductCard, Hero 등)
- `object-cover`, aspect 비율은 카드 계열마다 상이
- `normalizeProductImageUrl` / `getPrimaryImageUrl`
- Gallery: `ProductImageCarousel` (`showPlaceholderWhenEmpty`)
- HomeProductCard: picsum fallback

### 접근성 (코드에서 명확히 보이는 점)

- 대체로 button/anchor 구분, 햄버거 `aria-label`, 검색 select `sr-only` label
- focus-visible ring (`--focus-ring`) Button·카드·헤더에 존재
- ProductCard consult: `role="button"` + keyboard Enter/Space
- 상세 h1 `text-[#0f172a]` 등 토큰 우회 — 대비는 대체로 양호하나 토큰 일관성↓
- TabsTrigger: `min-h-[44px]` 터치 목표 고려

---

## [조사 결과 요약]

```text
실제 메인 상품상세 컴포넌트:
ProductDetailV2 (+ ProductDetailStickyV2Desktop/Mobile). ProductDetailTabs는 미사용 레거시.

실제 Product Card:
ProductCard(검색·연관) / HomeProductCard(홈) / ProductListCard+Mobile(/products) — 3계열 병존.

Header:
SiteHeader(RSC) → SiteHeaderUI sticky, lg 분기.

Mobile Navigation:
MobileHeaderMenu(햄버거+문의하기) → MobileHeaderDrawer.

Search:
Hero/Header → /search 또는 /products?q= . SearchFilters: 지역·테마·상품군 select.

Filter:
/products: 지역·테마 트리·product_line·collection·sort. 가격범위·출발일·기간 필터 없음. 페이지네이션 없음.

Sticky CTA:
있음 (상세 모바일 fixed bottom + 데스크톱 aside sticky)

공통 Design System:
부분적 (globals 토큰 + ui/Button·Card 등, shadcn 없음, radius 토큰 없음)

중복 UI:
ProductCard 계열 3종, Consult 모달 2종, RelatedSection 2종, DetailTabs 레거시

가장 먼저 개선할 영역 3개:
1. Product Card 시각·CTA 계약 통일 (탐색 일관성)
2. Product Detail 정보구조 슬림화 + 모바일 Tabs
3. CTA/문의 진입점·색상(primary/accent) 단일화

UI/UX 고도화 전 구조적으로 먼저 정리해야 할 사항:
레거시 미사용 컴포넌트 목록화·제거 계획, 카드 props/variant 단일 계약, 브랜드 accent hex(#e0612a vs #FF7A2F) 확정, /products vs /search 필터 모델 정합.
```

---

## 참고: 핵심 파일 절대 경로

| 역할 | Path |
|------|------|
| Root layout | `src/app/layout.tsx` |
| Home | `src/app/page.tsx` |
| Products index | `src/app/products/page.tsx` |
| Product detail | `src/app/products/[id]/page.tsx` |
| Search | `src/app/search/page.tsx` |
| Globals / tokens | `src/app/globals.css` |
| Fonts | `src/lib/fonts.ts` |
| Filters lib | `src/lib/productFilters.ts` |
| SiteHeader | `src/components/site-chrome/SiteHeader.tsx` |
| ProductDetailV2 | `src/components/products/ProductDetailV2.tsx` |
| ProductDetailStickyV2 | `src/components/products/ProductDetailStickyV2.tsx` |
| ProductCard | `src/components/products/ProductCard.tsx` |
| HomeProductCard | `src/components/products/HomeProductCard.tsx` |
| ProductsPageContent | `src/components/products/ProductsPageContent.tsx` |
| ConsultModal | `src/components/inquiry/ConsultModal.tsx` |
| Button | `src/components/ui/Button.tsx` |
