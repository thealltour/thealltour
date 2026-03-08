# 유저 페이지 공통 레이아웃 리팩토링(PR-A ~ PR-E) 코드 발췌

---

## 1) 유저 공통 layout 파일 전체 경로

| 용도 | 경로 |
|------|------|
| **루트(전체 유저)** | `src/app/layout.tsx` |
| **마이페이지** | `src/app/mypage/layout.tsx` |
| **리뷰 클레임** | `src/app/reviews/claim/layout.tsx` |

**공통 레이아웃 컴포넌트**
- `src/components/layout/ContentContainer.tsx` (max-w-6xl, mx-auto 래퍼)

**참고:** `(user)` 라우트 그룹은 없음. 홈/상품/상세 등은 모두 루트 `layout.tsx` 하위.

---

### 1-1. `src/app/layout.tsx` (전체)

```tsx
import type { Metadata } from "next";
import "./globals.css";
import GlobalSiteFooter from "@/components/GlobalSiteFooter";
import KakaoFloatingButton from "@/components/KakaoFloatingButton";
import { ConsultModalProvider } from "@/components/ConsultModal";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";

export const metadata: Metadata = {
  title: "더올투어 | 맞춤형 해외/국내 골프투어/파크골프투어 전문",
  description:
    "더올투어는 해외/국내 골프투어와 파크골프투어를 고객 맞춤형으로 설계하는 전문 여행사입니다. 상담부터 일정 운영, 현지 케어까지 신뢰 있게 안내합니다.",
  icons: {
    icon: "/thealltour-logo.png",
    shortcut: "/thealltour-logo.png",
    apple: "/thealltour-logo.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://qmswixmwquuazrhfyils.supabase.co" crossOrigin="" />
        <link rel="dns-prefetch" href="https://img.modetour.com" />
      </head>
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-[color:color-mix(in_oklab,var(--primary)_18%,white)] selection:text-foreground">
        <WebVitalsReporter />
        <ConsultModalProvider>
          <div className="flex-1">{children}</div>
          <KakaoFloatingButton />
          <GlobalSiteFooter />
        </ConsultModalProvider>
      </body>
    </html>
  );
}
```

---

### 1-2. `src/app/mypage/layout.tsx`

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMemberSessionFromCookies } from "@/lib/memberSession";

export default async function MypageRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) redirect("/login");

  return <>{children}</>;
}
```

---

### 1-3. `src/components/layout/ContentContainer.tsx`

```tsx
"use client";

export type ContentContainerProps = {
  children: React.ReactNode;
  className?: string;
};

export function ContentContainer({ children, className = "" }: ContentContainerProps) {
  return (
    <div className={`mx-auto w-full max-w-6xl ${className}`.trim()}>
      {children}
    </div>
  );
}
```

---

## 2) 홈 페이지 — 파일 경로 및 return JSX (150줄 내외)

**파일:** `src/app/page.tsx`

- Hero: `primaryBanner` 배경 + 스크림/오버레이, 모바일 `aspect-[16/11]` 이미지, `grid gap-10 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1.05fr)]`
- 추천: `CuratedBlock` → `space-y-8`, `md:grid md:grid-cols-3 md:gap-4` 상품 카드
- 프로모션/배너: Hero 섹션 내 `primaryBanner` 이미지
- 상품 카드: `CuratedProductCard` (이미지 `h-40 w-full overflow-hidden`)

```tsx
  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="page-content flex w-full flex-col gap-16 px-3 py-8 sm:px-6 md:gap-20 md:py-10 md:px-10">
        {/* 추천여행 (home curated) */}
        <section className="space-y-8 rounded-none bg-transparent px-3 py-6 ring-0 sm:rounded-3xl sm:bg-[var(--surface-muted)] sm:px-6 sm:py-10 sm:ring-1 sm:ring-[var(--border)] md:px-10">
          {curatedSettings?.is_active === true && curatedSections.length > 0 ? (
            <>
              <div className="space-y-2">
                <p className="text-sm font-semibold tracking-wide text-[var(--text-muted)] type-small">
                  {curatedSettings.section_label}
                </p>
                <h3 className="heading-display section-title type-h2 md:type-h2 text-[var(--foreground)]">
                  {curatedSettings.section_title}
                </h3>
                <p className="type-small text-[var(--text-muted)]">
                  {curatedSettings.section_description}
                </p>
              </div>

              <div className="space-y-8">
                {curatedSections.map((sec) => (
                  <CuratedBlock
                    key={sec.id}
                    title={sec.title}
                    description={sec.description}
                    products={sec.products}
                  />
                ))}

                <div className="pt-2">
                  <Link
                    href={curatedSettings.catalog_button_href}
                    className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                  >
                    {curatedSettings.catalog_button_label}
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-none border-0 bg-transparent p-0 shadow-none ring-0 type-small text-[var(--text-muted)] sm:rounded-2xl sm:border sm:border-[var(--border)] sm:bg-[var(--surface)] sm:p-8 sm:shadow-[var(--shadow-soft)]">
              메인 추천 상품이 없습니다. 관리자 페이지에서 추천 상품을 체크해 주세요.
            </div>
          )}
        </section>

        <section className="relative overflow-hidden rounded-none bg-[var(--hero-bg)] px-3 py-8 text-[var(--hero-text-primary)] shadow-none ring-0 sm:rounded-3xl sm:px-6 sm:py-12 sm:shadow-[var(--shadow-soft-strong)] sm:ring-1 sm:ring-[var(--border)] md:px-14 md:py-20">
          {primaryBanner ? (
            <>
              <div className="pointer-events-none absolute inset-0 hidden md:block">
                <Image
                  src={primaryBanner.image_url}
                  alt={primaryBanner.title}
                  fill
                  sizes="(min-width: 1024px) 960px, (min-width: 768px) 768px, 0px"
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

          <div className="relative z-10 space-y-8 md:space-y-10">
            {primaryBanner ? (
              <div className="overflow-hidden rounded-2xl ring-1 ring-[var(--hero-badge-border)] md:hidden">
                <div className="relative aspect-[16/11] w-full">
                  <Image
                    src={primaryBanner.mobile_image_url || primaryBanner.image_url}
                    alt={primaryBanner.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 0px"
                    priority
                    fetchPriority="high"
                    quality={82}
                    className="object-cover object-center"
                  />
                  <div className="pointer-events-none absolute inset-0 image-overlay-bottom" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 text-left text-[var(--hero-text-primary)]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--hero-text-secondary)]/90">
                      THEALL CURATION
                    </p>
                    <p className="mt-1 type-small font-semibold">{primaryBanner.title}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-10 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1.05fr)] md:items-center">
              <div className="space-y-6">
                <p className="inline-flex items-center gap-2 rounded-full bg-[var(--hero-badge-bg)] px-4 py-1 section-label text-[var(--hero-text-secondary)] md:type-small ring-1 ring-[var(--hero-badge-border)]">
                  THEALL TOUR PREMIUM GOLF
                </p>
                <h1 className="heading-display-hero type-h1 font-semibold leading-[1.15] md:text-[2.5rem]">
                  <span className="text-[var(--hero-accent)]">품격 있는</span> 골프와 여행의 시작
                </h1>
                <p className="max-w-xl type-small font-semibold text-[var(--hero-text-secondary)] md:type-body">
                  전담 상담사가 1:1 맞춤 설계를 진행하여, 일정·동행 구성·예산에 맞는 골프&여행 코스를 함께
                  정리해 드립니다.
                </p>
                <ul className="space-y-1.5 type-small text-[var(--hero-text-secondary)]/95">
                  <li>· 전화·메신저로 편하게 상담 시작</li>
                  <li>· 일정·항공·골프장까지 한 번에 비교 제안</li>
                  <li>· 출발 전·후 안내까지 전담 상담사가 지속 케어</li>
                </ul>
              </div>
              <div className="hidden min-h-[260px] md:block" />
            </div>
          </div>
        </section>

        {/* 신뢰 강조 섹션 */}
        <section className="rounded-none bg-transparent px-3 py-8 ring-0 sm:rounded-3xl sm:bg-[var(--surface-muted)] sm:px-6 sm:py-12 sm:ring-1 sm:ring-[var(--border)] md:px-10">
          <div className="mb-8 space-y-3 text-center">
            <p className="mx-auto max-w-2xl type-small text-[var(--text-muted)]">
              대형 여행사와의 공식 제휴와 검증된 일정 운영 경험을 바탕으로, 안정적인 예약과 운영을 약속드립니다.
            </p>
          </div>

          <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-7 lg:grid-cols-4">
            {/* 4개 카드: rounded-2xl sm:bg-[var(--surface)] ... */}
          </div>
        </section>

        {/* 메인 카테고리 섹션 - 골프 3종 + 일반 여행 */}
        <section className="space-y-8 rounded-none bg-transparent px-3 py-8 ring-0 sm:rounded-3xl sm:bg-[var(--surface-muted)] sm:px-6 sm:py-12 sm:ring-1 sm:ring-[var(--border)] md:px-10">
          <div className="space-y-2 text-left md:text-center">
            <p className="mx-auto max-w-2xl type-small text-[var(--text-muted)] md:type-body">
              검증된 일정과 안정적인 운영으로 안내합니다.
            </p>
          </div>

          <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-3 md:gap-6">
            <Link
              href="/products?category=해외 골프 투어"
              className="group relative overflow-hidden rounded-3xl bg-[var(--surface)] ..."
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--surface-muted)] ..." />
              <div className="relative flex h-full flex-col justify-between p-6 md:p-7">
                ...
              </div>
            </Link>
            {/* 국내 골프, 파크골프 카드 동일 패턴 */}
          </div>

          <Link
            href="/products"
            className="group relative mt-6 flex flex-col justify-between overflow-hidden rounded-3xl ... md:flex-row md:items-center md:px-8 md:py-5"
          >
            ...
          </Link>
        </section>

        <section id="contact" className="rounded-none bg-transparent px-3 py-8 ring-0 sm:rounded-3xl ... md:px-12 md:py-14">
          <div className="grid items-start gap-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)]">
            ...
          </div>
        </section>
      </main>
    </div>
  );
```

---

## 3) 상품 목록/검색 결과 페이지 — 경로 및 return JSX

**파일:** `src/app/products/page.tsx`
**필터/정렬/리스트:** `src/components/products/ProductsPageContent.tsx` + `ProductCatalogSection.tsx` + `ProductFilterSidebar.tsx`

### 3-1. `src/app/products/page.tsx` (return JSX)

```tsx
  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] text-[var(--text-primary)]">
      <SiteHeader activeTab="products" searchQuery={searchKeyword} golfPresetActive={golfPresetActive} />

      <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-10 md:px-10 md:py-14">
        <div className="flex flex-col gap-8">
          <ProductsHero variant={golfPresetActive ? "golf" : "package"} />

          {products.length === 0 ? (
            <section className="rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-2xl sm:bg-[var(--surface)] sm:p-8 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] type-small text-[var(--text-muted)]">
              현재 등록된 상품이 없습니다. 관리자 페이지에서 상품을 등록해 주세요.
            </section>
          ) : (
            <ProductsPageContent
              products={products}
              regionOptions={categories}
              themeOptions={themes}
              initialKeyword={searchKeyword}
              presetCategories={presetCategories}
              presetLabel={presetLabel}
            />
          )}
        </div>
      </main>
    </div>
  );
```

### 3-2. `src/components/products/ProductsPageContent.tsx` — 필터/정렬/결과 영역

```tsx
  return (
    <div className="flex gap-6">
      <ProductFilterSidebar
        regionOptions={regionOptions}
        themeOptions={themeOptions}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      <div className="min-w-0 flex-1 space-y-4">
        {/* 모바일 전용: 필터/정렬 버튼 + 선택 칩 */}
        <div className="flex flex-wrap items-center gap-2 lg:hidden">
          <button type="button" onClick={() => setFilterDrawerOpen(true)} ...>필터</button>
          <button type="button" onClick={() => setSortSheetOpen(true)} ...>{sortLabel ?? "정렬"}</button>
        </div>

        <ProductFilterChips ... />

        <ProductCatalogSection
          products={filteredProducts}
          categories={regionOptions}
          ...
        />
      </div>

      <MobileProductFilterDrawer ... />
      <MobileProductSortSheet ... />
    </div>
  );
```

### 3-3. `ProductCatalogSection` — 탭/결과 그리드 (일부)

```tsx
  return (
    <section className="space-y-5">
      <div className="sticky top-[76px] z-20 space-y-3 rounded-2xl bg-[var(--surface)]/95 p-3 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] backdrop-blur">
        <p className="section-label text-content-muted">
          총 {keywordFilteredProducts.length}건 · 현재 카테고리 {activeTab === "all" ? "전체" : activeTab}
        </p>
        ...
        <div className="flex flex-wrap items-center gap-2">
          {categoryTabs.map((tab) => (
            <button key={tab} type="button" onClick={...} className={`type-btn rounded-full px-3.5 py-1.5 ...`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {themeTabs.map((tab) => (
            <button key={`theme-${tab}`} ...>{tab}</button>
          ))}
        </div>
      </div>

      <div key={`${activeTab}-${activeThemeTab}`} className="fade-in-up space-y-6">
        {keywordFilteredProducts.length === 0 ? (
          <div className="rounded-2xl bg-[var(--surface)] p-8 type-small text-[var(--text-muted)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] md:col-span-2">
            ...
          </div>
        ) : (
          displayGroups.map((group) => (
            <div key={group.theme} className="space-y-3">
              <h3 className="font-card-title type-h3 text-[var(--primary)]">{group.theme}</h3>
              <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-6">
                {group.products.map((product) => (
                  <ProductCardV2 key={product.id} ... />
                  // 또는 레거시: <Link className="h-full overflow-hidden rounded-3xl ...">
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
```

### 3-4. `ProductFilterSidebar` — 필터 영역

```tsx
  return (
    <aside
      className={cn(
        "hidden lg:block w-56 shrink-0 space-y-6",
        className,
      )}
      aria-label="상품 필터"
    >
      <div className="sticky top-24 space-y-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
        {/* 지역 / 테마 / 정렬 fieldset */}
      </div>
    </aside>
  );
```

---

## 4) 상품 상세 페이지 — 경로 및 return JSX

**파일:** `src/app/products/[id]/page.tsx`
**상단 hero/갤러리·요약·본문·sticky CTA:** `ProductDetailV2.tsx` + `ProductDetailStickyV2.tsx`

### 4-1. `src/app/products/[id]/page.tsx` (return JSX, ENABLE_NEW_PRODUCT_UI 시)

```tsx
  return (
    <ConsultModalProvider>
      <ProductQuoteProvider>
      <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white px-3 py-6 sm:px-6 sm:py-10 md:px-10">
        <main className="mx-auto w-full max-w-6xl">
          <div className="mb-6 md:hidden">
            <Link
              href="/products"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              ← 상품 목록으로
            </Link>
          </div>

          <div className="flex gap-8 lg:items-start">
            <div className="min-w-0 flex-1 space-y-6">
              <section className="overflow-hidden rounded-none bg-transparent shadow-none ring-0 sm:rounded-3xl sm:bg-white sm:shadow-md sm:ring-1 sm:ring-[#dbeafe]">
                <script type="application/ld+json" ... />
                <div className="p-0 sm:p-6 md:p-8">
                  <ProductDetailV2 ... />
                </div>
              </section>

              <ProductReviewsSection ... />

              <AlertCard variant="info" title="상담 안내">...</AlertCard>
            </div>

            <ProductDetailStickyV2Desktop ... />
          </div>
        </main>

        <ProductDetailStickyV2Mobile ... />
      </div>
      </ProductQuoteProvider>
    </ConsultModalProvider>
  );
```

### 4-2. `ProductDetailV2` — Hero/갤러리·요약·본문 (상단~첫 섹션)

```tsx
  return (
    <div className="space-y-8">
      {/* DetailHero */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {region ? <Tag variant="accent" size="sm">{region}</Tag> : null}
          {category ? <Tag variant="accent" size="sm">{category}</Tag> : null}
          {statusTag != null && <Tag ...>{STATUS_LABELS[statusTag]}</Tag>}
        </div>

        <h1 className="font-card-title text-2xl font-bold leading-tight text-[#0f172a] md:text-3xl">
          {title || "상품명"}
        </h1>

        {reviewSummary && reviewSummary.reviewCount > 0 && (
          <a href="#reviews" className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 ...">
            ★ {reviewSummary.averageRating.toFixed(1)} (후기 {reviewSummary.reviewCount})
          </a>
        )}

        {oneLiner ? <p className="whitespace-pre-wrap text-sm leading-[1.75] text-slate-600 md:text-base">{oneLiner}</p> : null}
        <ProductImageCarousel images={galleryImages} showPlaceholderWhenEmpty />

        {/* Price Summary Card: 모바일 전용 */}
        <Card variant="default" className="border-[#dbeafe] bg-[#f8fbff] p-5 ring-[#dbeafe] md:hidden">
          ...
        </Card>

        {hasOptions && <div id="product-options-panel" ref={optionsPanelRef}><OptionPanel ... /></div>}
        {hasOptions && ... && <QuoteSummary quote={quote} />}
        <TrustSignals trust={trust} />
        <div className="mb-0 md:hidden">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="md" onClick={handlePrimaryCta}>상담 문의</Button>
            {kakaoHref ? <a href={kakaoHref}><Button variant="outline" size="md">카톡 상담</Button></a> : null}
          </div>
        </div>
      </section>

      <TravelOverviewV2 model={overviewForCards} product={product} ... />

      {/* Tabs: 일정 안내 / 포함·불포함 / 예약 조건 / 환불·취소 */}
      <section>
        <Tabs value={activeTab} onChange={(v) => setActiveTab(v as MainTab)} className="mb-4 flex flex-wrap gap-2">
          <TabsTrigger value="schedule">일정 안내</TabsTrigger>
          ...
        </Tabs>
        {activeTab === "schedule" && (
          <div id="itinerary-section" className="space-y-6">
            {hasVisualItinerary && timelineModel?.days?.length ? (
              <InteractiveTimelineV2 ... />
            ) : hasSchedule ? (
              scheduleDays.map((day, index) => (
                <Card key={...} variant="default" className="overflow-hidden border-[var(--border)] bg-[var(--surface-muted)]">
                  ...
                </Card>
              ))
            ) : (
              <p className="text-sm text-slate-500">일정 정보 준비 중입니다.</p>
            )}
          </div>
        )}
        ...
      </section>
    </div>
  );
```

### 4-3. `ProductDetailStickyV2Desktop` — Sticky CTA(예상가·상담)

```tsx
  return (
    <aside
      className="hidden md:block sticky top-24 w-full max-w-[280px] shrink-0 space-y-4"
      aria-label="상품 요약"
    >
      <Link href="/products" className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2 ...">
        ← 상품 목록으로
      </Link>
      {seoHashtags.length > 0 && (
        <div className="rounded-2xl border border-[#dbeafe] bg-white p-4 shadow-lg ring-1 ring-[#dbeafe]">...</div>
      )}
      {chart && (
        <div className="rounded-2xl border border-[#dbeafe] bg-white p-4 shadow-lg ring-1 ring-[#dbeafe]">
          <ThemeChartCard items={chart.items} />
        </div>
      )}
      <div className="rounded-2xl border border-[#dbeafe] bg-white p-5 shadow-lg ring-1 ring-[#dbeafe]">
        <p className="text-sm font-semibold text-slate-500">예상가</p>
        {displayPrice ? <p className="font-price-strong mt-1 text-xl font-bold text-[#1E3A8A]">₩{displayPrice}~</p> : ...}
        ...
        <TrustSignals trust={trust} className="mt-3" />
        <div className="mt-4 flex flex-col gap-2">
          <Button variant="primary" size="md" onClick={handlePrimaryClick}>상담 문의하기</Button>
          <a href={kakaoHref}><Button variant="outline" size="md" className="w-full">카톡 상담</Button></a>
        </div>
      </div>
    </aside>
  );
```

### 4-4. `ProductDetailStickyV2Mobile` — 하단 고정 CTA

```tsx
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-[var(--divider)] bg-[var(--glass-surface)] px-3 backdrop-blur transition-all duration-200 md:hidden"
      style={{
        paddingTop: compact ? "8px" : "12px",
        paddingBottom: compact ? "max(8px, env(safe-area-inset-bottom))" : "max(12px, env(safe-area-inset-bottom))",
      }}
    >
      {displayPrice ? <span className="font-price-strong text-sm font-bold text-[#1E3A8A]">₩{displayPrice}~</span> : ...}
      <div className="flex flex-1 gap-2">
        <Button variant="primary" size="md" onClick={handlePrimaryClick} className="flex-1">상담 문의</Button>
        <a href={kakaoHref}><Button variant="outline" size="md">카톡</Button></a>
      </div>
    </div>
  );
```

---

## 5) 공통 카드·래퍼 컴포넌트

| 용도 | 파일 경로 |
|------|------------|
| 상품 카드(레거시) | `src/components/ProductCard.tsx` |
| 상품 카드 V2 | `src/components/products/ProductCardV2.tsx` |
| 홈 추천 상품 카드 | `src/components/home/CuratedProductCard.tsx` |
| 섹션 wrapper(추천 블록) | `src/components/home/CuratedBlock.tsx` |
| 컨테이너 wrapper | `src/components/layout/ContentContainer.tsx` |

**배너 카드:** 홈 Hero는 `page.tsx` 내 `primaryBanner` + `Image` + `aspect-[16/11]`로 직접 구현. 별도 배너 카드 컴포넌트는 없음.

### 5-1. `ProductCard.tsx` — 이미지·본문·CTA (className 포함)

```tsx
  return (
    <Link
      href={href}
      className={`group flex h-full flex-col overflow-hidden rounded-3xl bg-[var(--card)] shadow-[var(--shadow-soft-strong)] ring-1 ring-[var(--border)] ${TRANSITION} hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft-strong)]`}
    >
      <div className="relative h-52 w-full overflow-hidden">
        <Image
          src={imageUrl}
          alt={imageAlt}
          width={900}
          height={560}
          sizes="(max-width: 768px) 100vw, 50vw"
          loading="lazy"
          className={`h-full w-full object-cover ${TRANSITION} group-hover:scale-[1.03]`}
        />
        ...
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        ...
      </div>
    </Link>
  );
```

### 5-2. `ProductCardV2.tsx` — 레이아웃 관련 부분

```tsx
  const cardContent = (
    <div className="flex min-h-[140px] w-full">
      <div className="relative w-[44%] max-w-[220px] shrink-0 overflow-hidden bg-[var(--surface-muted)]">
        ...
        {thumbnailUrl ? (
          <Image
            src={normalizeProductImageUrl(thumbnailUrl)}
            alt={title || "상품 이미지"}
            fill
            sizes="(max-width: 768px) 44vw, 220px"
            className={`h-full w-full object-cover ${TRANSITION} group-hover:scale-[1.02]`}
            ...
          />
        ) : null}
        ...
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="relative min-h-[1.25rem] overflow-hidden">
          <h2 className="font-card-title line-clamp-1 pr-8 text-sm font-semibold ...">
            {title || "상품명"}
          </h2>
          <div className="pointer-events-none absolute right-0 top-0 h-full w-12 shrink-0 bg-gradient-to-l from-[var(--surface)] to-transparent" aria-hidden />
        </div>
        ...
      </div>
    </div>
  );

  const wrapperClass = `group flex h-full overflow-hidden rounded-2xl ${TRANSITION} hover:shadow-xl`;
  return (
    <Link href={hrefDetail} className="block h-full" onClick={handleCardClick}>
      <Card variant="elevated" className={wrapperClass}>
        {cardContent}
      </Card>
    </Link>
  );
```

### 5-3. `CuratedProductCard.tsx`

```tsx
  return (
    <Link
      href={href}
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] transition-colors duration-150 hover:shadow-[var(--shadow-soft-strong)] hover:ring-[var(--border-strong)]"
      onClick={() => trackProductCardClick({...})}
    >
      <div className="relative h-40 w-full overflow-hidden">
        <Image
          src={product.image_url ?? ""}
          alt={`${product.title ?? "상품"} 대표 이미지`}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--overlay)] via-[var(--overlay)]/20 to-transparent" />
        <div className="absolute inset-0 overlay-radial-blue-subtle opacity-80 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="relative flex flex-1 flex-col gap-2 p-4">
        ...
      </div>
    </Link>
  );
```

### 5-4. `CuratedBlock.tsx` — 섹션 wrapper + 그리드

```tsx
  return (
    <section className="space-y-4 rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-3xl sm:bg-[var(--surface)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
        <div>
          <h4 className="font-card-title type-h3 text-[var(--foreground)] md:text-[1.375rem]">{title}</h4>
          <p className="mt-1 type-caption leading-relaxed text-[var(--text-muted)] md:type-small">{description}</p>
        </div>
      </div>

      <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-3 md:gap-4">
        {products.map((product) => (
          <CuratedProductCard key={product.id} product={product} sectionTitle={title} />
        ))}
      </div>
    </section>
  );
```

### 5-5. `ContentContainer.tsx` (재발췌)

```tsx
export function ContentContainer({ children, className = "" }: ContentContainerProps) {
  return (
    <div className={`mx-auto w-full max-w-6xl ${className}`.trim()}>
      {children}
    </div>
  );
}
```

---

## 6) 레이아웃 관련 className 정리 (발췌 기준)

요청하신 키워드가 들어간 대표 예시만 정리했습니다.

| 키워드 | 사용 위치 예시 |
|--------|----------------|
| **max-w-** | `max-w-6xl` (products page main, product detail main, ContentContainer), `max-w-2xl` (홈 신뢰 섹션 문구), `max-w-xl` (Hero 문구), `max-w-md` (ProductsHero 폼), `max-w-[280px]` (Sticky 데스크톱) |
| **container** | 사용처 없음 (직접 `max-w-*` + `mx-auto` 조합 사용) |
| **mx-auto** | `mx-auto w-full max-w-6xl` (상품 목록/상세 main), ContentContainer `mx-auto w-full max-w-6xl`, 홈 `mx-auto max-w-2xl` 등 |
| **px-** | `px-3`, `px-4`, `px-5`, `px-6`, `md:px-10`, `sm:px-6`, `md:px-14`, `md:px-12` 등 전 페이지 공통 |
| **grid-cols-** | `md:grid-cols-2`, `lg:grid-cols-4`, `md:grid-cols-3`, `md:grid-cols-[minmax(0,1.35fr)_minmax(0,1.05fr)]`, `md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]` (ProductsHero) |
| **gap-** | `gap-2`, `gap-3`, `gap-4`, `gap-6`, `gap-8`, `gap-10`, `gap-16`, `md:gap-20`, `md:gap-6`, `md:gap-7`, `md:gap-8` 등 |
| **aspect-** | 홈 Hero 모바일 `aspect-[16/11]` (배너 이미지) |
| **min-w-0** | `min-w-0 flex-1` (ProductsPageContent 본문, 상세 본문 컬럼, ProductCardV2 텍스트 영역) |
| **w-full** | `w-full` (main, ContentContainer, 이미지/폼 등 다수) |
| **overflow-hidden** | `overflow-hidden` (Hero 섹션, 카드 이미지 영역, ProductCard/CuratedProductCard, 상세 section, 카테고리 카드 등) |

---

이 구간까지가 유저 페이지 공통 레이아웃 리팩토링(PR-A ~ PR-E) 설계에 쓸 수 있는 발췌 범위입니다.
