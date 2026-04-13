# 관리자 랜딩·큐레이션·홈 렌더링 코드 발췌

**생성 목적:** 「관리자 랜딩 생성 시스템」(템플릿·섹션 자동 생성·편집·미리보기·발행) 설계 시, 기존 패턴(상품 관리·home_curated·가이드·견적)과의 연결을 한 문서에서 추적하기 위함.

**참고:** `src/types/supabase.ts`는 레포에 없음. DB 스키마는 `supabase/migrations`·`supabase/*.sql`, 도메인 타입은 `src/types/*.ts`를 사용.

**전문 사본:** 요청하신 순서대로 검토할 수 있도록, 아래 원본의 **전체 텍스트**를 `docs/excerpts-full/*.txt`에 두었습니다. (파일명은 경로의 `/`·`[]`를 `_` 등으로 치환한 것입니다.)

| 원본 경로 | `docs/excerpts-full/` 복사본 |
|-----------|------------------------------|
| `src/app/admin/products/page.tsx` | `src_app_admin_products_page.tsx.txt` |
| `src/components/admin/products/AdminProductManager.tsx` | `AdminProductManager.tsx.txt` |
| `src/components/admin/SubHeader.tsx` | `src_components_admin_SubHeader.tsx.txt` |
| `src/app/theall_manager_only/layout.tsx` | `src_app_theall_manager_only_layout.tsx.txt` |
| `src/app/theall_manager_only/page.tsx` | `src_app_theall_manager_only_page.tsx.txt` |
| `src/app/theall_manager_only/products/page.tsx` | `src_app_theall_manager_only_products_page.tsx.txt` |
| `src/app/theall_manager_only/guides/page.tsx` | `src_app_theall_manager_only_guides_page.tsx.txt` |
| `src/components/admin/AdminRouteProviders.tsx` | `src_components_admin_AdminRouteProviders.tsx.txt` |
| `src/components/admin/products/AdminHomeCuratedManager.tsx` | `src_components_admin_products_AdminHomeCuratedManager.tsx.txt` |
| `src/components/admin/products/HomeCuratedSettingsPanel.tsx` | `src_components_admin_products_HomeCuratedSettingsPanel.tsx.txt` |
| `src/components/admin/products/HomeCuratedSectionsPanel.tsx` | `src_components_admin_products_HomeCuratedSectionsPanel.tsx.txt` |
| `src/components/admin/products/HomeCuratedSectionProductsPanel.tsx` | `src_components_admin_products_HomeCuratedSectionProductsPanel.tsx.txt` |
| `src/components/admin/products/api/adminHomeCurated.client.ts` | `src_components_admin_products_api_adminHomeCurated.client.ts.txt` |
| `src/app/api/admin/home-curated/route.ts` | `src_app_api_admin_home-curated_route.ts.txt` |
| `src/app/api/admin/home-curated/settings/route.ts` | `src_app_api_admin_home-curated_settings_route.ts.txt` |
| `src/app/api/admin/home-curated/sections/route.ts` | `src_app_api_admin_home-curated_sections_route.ts.txt` |
| `src/app/api/admin/home-curated/sections/[id]/route.ts` | `src_app_api_admin_home-curated_sections_id_route.ts.txt` |
| `src/app/api/admin/home-curated/sections/[id]/products/route.ts` | `src_app_api_admin_home-curated_sections_id_products_route.ts.txt` |
| `src/app/api/admin/home-curated/sections/[id]/products/[mappingId]/route.ts` | `src_app_api_admin_home-curated_sections_id_products_mappingId_route.ts.txt` |
| `supabase/home_curated.sql` | `supabase_home_curated.sql.txt` |
| `src/types/homeCurated.ts` | `src_types_homeCurated.ts.txt` |
| `src/lib/homeCurated.ts` | `src_lib_homeCurated.ts.txt` |
| `src/components/admin/products/adminProducts.constants.ts` | `src_components_admin_products_adminProducts.constants.ts.txt` |
| `src/lib/hubLandingLinks.ts` | `src_lib_hubLandingLinks.ts.txt` |
| `src/app/page.tsx` | `src_app_page.tsx.txt` |
| `src/app/quote/page.tsx` | `src_app_quote_page.tsx.txt` |
| `src/app/guides/[slug]/page.tsx` | `src_app_guides_slug_page.tsx.txt` |
| `src/app/recommended/page.tsx` | `src_app_recommended_page.tsx.txt` |
| `src/components/layout/PageContainer.tsx` | `src_components_layout_PageContainer.tsx.txt` |
| `src/components/layout/SectionBlock.tsx` | `src_components_layout_SectionBlock.tsx.txt` |
| `src/components/home/CuratedProductsSection.tsx` | `src_components_home_CuratedProductsSection.tsx.txt` |
| `src/components/home/HeroSection.tsx` | `HeroSection.tsx.txt` |
| `src/components/landing/HeroVisual.tsx` | `src_components_landing_HeroVisual.tsx.txt` |
| `src/components/landing/LandingDetailHero.tsx` | `src_components_landing_LandingDetailHero.tsx.txt` |
| `src/lib/analytics/events.ts` | `src_lib_analytics_events.ts.txt` |
| `src/lib/analytics/trackQuoteEvent.ts` | `src_lib_analytics_trackQuoteEvent.ts.txt` |
| `src/components/quote/QuotePageContent.tsx` | `src_components_quote_QuotePageContent.tsx.txt` |

`theall_manager_only`의 나머지 `page.tsx`들은 동일 패턴의 얇은 라우트이므로, 필요 시 `src/app/theall_manager_only/**/page.tsx`에서 직접 열면 됩니다.

---

## 설계 판단용 요약

- **관리자 메뉴:** `SubHeader`의 상품 탭에서 `?view=featured` → `메인 추천상품 관리` → `AdminProductManager` 안의 `AdminHomeCuratedManager` + 캠페인 컬렉션. 새 「랜딩 빌더」는 **상품 하위 탭** 또는 **독립 1depth 메뉴**(가이드처럼 `theall_manager_only/...`) 중 선택 가능. 홈과 직결되는 큐레이션이면 상품·홈 설정 근처가 자연스럽습니다.
- **재사용 패턴:** `home_curated` = **설정 행 1건 + 섹션 N + 섹션–상품 매핑** + **관리자 fetch 클라이언트** + **API에서 `revalidateTag(HOME_CURATED)` + `revalidatePath("/")`**. 랜딩 빌더도 동일하게 「페이지 메타 1건 + 섹션 테이블 + 블록/콘텐츠 조인 + 캐시 태그 무효화」로 확장하기 좋습니다.
- **신규 테이블:** 타입에 이미 `slug`, `landing_enabled`가 있고 `getRecommendedSectionBySlugForPublicLanding` 등이 준비되어 있음 → **`/recommended/[slug]` 전용 랜딩**은 DB 컬럼·라우트만 맞추면 확장 가능. 완전히 다른 「자유 레이아웃 랜딩」이면 `landing_pages` + `landing_sections` JSON/jsonb 같은 **별도 스키마**가 더 깔끔할 수 있음.
- **`/quote` 연결:** 서버에서 `searchParams`의 `product_id`, `product_title`, `source_path`를 넘기고, 클라이언트 `QuotePageContent`가 `trackQuotePageView` + `InquiryForm`에 `source` 전달. 랜딩 CTA는 **`/quote?product_id=...&source_path=/recommended/...`** 형태로 통일하면 추적·상담 맥락이 유지됩니다.

---

## 1. 관리자 상품 페이지

### `src/app/admin/products/page.tsx`

```tsx
import { Suspense } from "react";
import AdminProductManager from "@/components/admin/products/AdminProductManager";
import AdminToastProvider from "@/components/admin/AdminToastProvider";
import AdminConfirmProvider from "@/components/admin/AdminConfirmProvider";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminProductsPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="w-full space-y-6">
        <section className="rounded-2xl bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] md:p-5 overflow-visible">
          <Suspense
            fallback={
              <div className="h-32 animate-pulse rounded-xl bg-[var(--surface-muted)]" aria-hidden="true" />
            }
          >
            <AdminToastProvider>
              <AdminConfirmProvider>
                <AdminProductManager />
              </AdminConfirmProvider>
            </AdminToastProvider>
          </Suspense>
        </section>
      </main>
    </div>
  );
}
```

### `src/components/admin/products/AdminProductManager.tsx`

**전문:** `docs/excerpts-full/AdminProductManager.tsx.txt`  
**역할 요약:** `view` 쿼리로 목록/등록/분류/추천(피처드)/지역·테마 카드 전환. 피처드 뷰에서 홈 큐레이션 진입.

```1621:1626:src/components/admin/products/AdminProductManager.tsx
      {isFeaturedView && (
        <div className="space-y-10">
          <AdminProductsCollectionCampaignsManager />
          <AdminHomeCuratedManager />
        </div>
      )}
```

---

## 2. `SubHeader` (상품 탭 ↔ `view` 매핑)

### `src/components/admin/SubHeader.tsx`

**전문이 매우 깁니다.** 핵심은 `menuMap.product`에 **「메인 추천상품 관리」** 포함, `handleTabClick`에서 `ADMIN_PRODUCTS_QUERY_KEYS.VIEW` 설정.

```46:48:src/components/admin/SubHeader.tsx
export const menuMap = {
  dashboard: ["운영 현황", "통계"],
  product: ["상품 목록", "상품 등록", "상품 등록(모두)", "카테고리/테마 관리", "메인 지역카드", "메인 테마카드", "메인 추천상품 관리"],
```

```104:122:src/components/admin/SubHeader.tsx
    if (activeMenu === "product") {
      const view = searchParams.get(ADMIN_PRODUCTS_QUERY_KEYS.VIEW);
      if (pathname.includes("/products/new-modetour")) {
        initial = "상품 등록(모두)";
      } else if (view === ADMIN_PRODUCTS_VIEW.TAXONOMY) {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.TAXONOMY];
      } else if (view === ADMIN_PRODUCTS_VIEW.FEATURED) {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.FEATURED];
      } else if (view === ADMIN_PRODUCTS_VIEW.HOME_REGION_CARDS) {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.HOME_REGION_CARDS];
      } else if (view === ADMIN_PRODUCTS_VIEW.HOME_THEME_CARDS) {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.HOME_THEME_CARDS];
      } else if (view === ADMIN_PRODUCTS_VIEW.CREATE) {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.CREATE];
      } else if (view === ADMIN_PRODUCTS_VIEW.LIST) {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.LIST];
      } else {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.LIST];
      }
    }
```

---

## 3. `theall_manager_only` 관리자 라우트

| 파일 | 내용 |
|------|------|
| `src/app/theall_manager_only/layout.tsx` | `AdminRouteProviders`로 `/admin`과 동일 셸 |
| `src/app/theall_manager_only/page.tsx` | `export { default } from "@/app/admin/page"` |
| `src/app/theall_manager_only/products/page.tsx` | `export { default } from "@/app/admin/products/page"` |
| 기타 | `inquiries`, `guides`, `banners`, `members`, … 각 `page.tsx` |

### `src/app/theall_manager_only/layout.tsx`

```tsx
import type { ReactNode } from "react";
import { AdminRouteProviders } from "@/components/admin/AdminRouteProviders";
import type { AdminRole } from "@/types/adminRole";

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  // TODO: Replace with real auth-based role resolution.
  const role: AdminRole = "admin";
  return <AdminRouteProviders role={role}>{children}</AdminRouteProviders>;
}
```

### `src/components/admin/AdminRouteProviders.tsx` (연결부)

```tsx
/**
 * /admin·/theall_manager_only 공통: Query/Role/Toast/Confirm + AdminResponsiveFrame.
 * 뷰포트에 따라 AdminLayout(데스크톱) 또는 MobileAdminShell(모바일)을 선택합니다.
 */
export function AdminRouteProviders({ children, role = "admin" }: AdminRouteProvidersProps) {
  return (
    <AdminQueryProvider>
      <AdminRoleProvider role={role}>
        <AdminToastProvider>
          <AdminConfirmProvider>
            <Suspense fallback={...}>
              <AdminResponsiveFrame>{children}</AdminResponsiveFrame>
            </Suspense>
          </AdminConfirmProvider>
        </AdminToastProvider>
      </AdminRoleProvider>
    </AdminQueryProvider>
  );
}
```

### `src/app/theall_manager_only/guides/page.tsx` (가이드 관리 예시)

```tsx
import AdminHeader from "@/components/admin/AdminHeader";
import AdminGuideManager from "@/components/admin/AdminGuideManager";

export const dynamic = "force-dynamic";

export default function AdminGuidesPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader activeTab="guides" title="여행가이드 관리" ... />
        <AdminGuideManager />
      </main>
    </div>
  );
}
```

---

## 4. 홈 큐레이션(`home_curated`) 관리자 UI · API

### 상수: `src/components/admin/products/adminProducts.constants.ts`

```ts
export const ADMIN_PRODUCTS_VIEW = {
  LIST: "list",
  CREATE: "create",
  TAXONOMY: "taxonomy",
  FEATURED: "featured",
  HOME_REGION_CARDS: "home-region-cards",
  HOME_THEME_CARDS: "home-theme-cards",
} as const;

export const PRODUCT_LABEL_TO_VIEW: Record<string, AdminProductsViewKey> = {
  "카테고리/테마 관리": ADMIN_PRODUCTS_VIEW.TAXONOMY,
  "메인 추천상품 관리": ADMIN_PRODUCTS_VIEW.FEATURED,
  ...
};
```

### 타입: `src/types/homeCurated.ts`

```ts
export type HomeCuratedSettings = {
  id: string;
  setting_key: string;
  section_label: string;
  section_title: string;
  section_description: string;
  catalog_button_label: string;
  catalog_button_href: string;
  is_active: boolean;
  ...
};

export type HomeCuratedSection = {
  id: string;
  setting_id: string;
  title: string;
  description: string;
  sort_order: number;
  max_items: number;
  is_active: boolean;
  slug?: string | null;
  landing_enabled?: boolean;
  ...
};
```

### 클라이언트 API: `src/components/admin/products/api/adminHomeCurated.client.ts`

- `GET /api/admin/home-curated`
- `PATCH /api/admin/home-curated/settings`
- `POST|PATCH|DELETE /api/admin/home-curated/sections` …
- `GET|POST|PATCH|DELETE .../sections/[id]/products` …

(전문은 해당 파일 참고 — 레포 내 약 195줄.)

### 서버 라우트 (CRUD + 캐시 무효화)

- `src/app/api/admin/home-curated/route.ts` — GET 목록
- `src/app/api/admin/home-curated/settings/route.ts` — PATCH 설정, `revalidateTag(CACHE_TAGS.HOME_CURATED)`, `revalidatePath("/")`
- `src/app/api/admin/home-curated/sections/route.ts` — POST 섹션 생성
- `src/app/api/admin/home-curated/sections/[id]/route.ts` — PATCH, DELETE
- `src/app/api/admin/home-curated/sections/[id]/products/route.ts` — GET, POST
- `src/app/api/admin/home-curated/sections/[id]/products/[mappingId]/route.ts` — PATCH, DELETE

### 컴포넌트

- `src/components/admin/products/AdminHomeCuratedManager.tsx` — 상태·로드·저장 오케스트레이션
- `src/components/admin/products/HomeCuratedSettingsPanel.tsx`
- `src/components/admin/products/HomeCuratedSectionsPanel.tsx`
- `src/components/admin/products/HomeCuratedSectionProductsPanel.tsx`

### DB 스키마 발췌: `supabase/home_curated.sql` (앞부분)

`home_curated_settings`, `home_curated_sections`, `home_curated_section_products` 테이블 정의 및 인덱스.

---

## 5. 사용자 홈 · 견적 · 동적 랜딩

### `src/app/page.tsx` (데이터 병렬 로드 + 섹션 순서)

```tsx
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
  ...
  return (
    <>
      <SiteHeader />
      <div className="min-h-screen ...">
        <main className="...">
          <HeroSection heroBanners={topBanners} hero={hero} />
          <PageContainer size="wide" className="...">
            <DestinationSection ... />
            <ThemeSection ... />
            <CuratedProductsSection settings={curatedSettings} sections={curatedSections} />
            <HomeGuideSection guides={homeGuides} />
            <HomeReviewSection reviews={homeReviews} />
            <SectionBlock>...</SectionBlock>
            <SectionBlock id="contact">... <HeroQuickConsultButton /></SectionBlock>
          </PageContainer>
        </main>
      </div>
    </>
  );
}
```

### `src/app/quote/page.tsx`

```tsx
export default async function QuotePage({ searchParams }: QuotePageProps) {
  const query = (await searchParams) ?? {};
  ...
  return (
    <div className="min-h-screen ...">
      <SiteHeader activeTab="quote" />
      <SectionBody className="...">
        <PageHero kicker="THEALL TOUR QUOTE" title="맞춤 견적 문의" ... />
        <ContentCard>
          <QuotePageContent
            source={{
              product_id: query.product_id,
              product_title: productSummary?.productTitle ?? query.product_title,
              source_path: query.source_path,
            }}
            productSummary={productSummary}
          />
        </ContentCard>
      </SectionBody>
    </div>
  );
}
```

### 동적 랜딩 예시: `src/app/guides/[slug]/page.tsx`

**전문:** `docs/excerpts-full/guides-slug-page.tsx.txt`  
`getGuideBySlug` → `notFound()` / `HeroVisual` / `ProductCard` 그리드 등 CMS형 상세.

### 추천 허브: `src/app/recommended/page.tsx` (발췌)

`getHomeCuratedData()`, `LandingHero`, `CuratedBlock`, `getRecommendedLandingHref(sec)`로 섹션별 상세 랜딩 링크 분기.

---

## 6. 레이아웃 · 공통 섹션 컴포넌트

### `src/components/layout/PageContainer.tsx`

```tsx
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

### `src/components/layout/SectionBlock.tsx` (전체)

```tsx
"use client";

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

### 홈 히어로

**전문:** `docs/excerpts-full/HeroSection.tsx.txt`

### 큐레이션 카드 섹션: `src/components/home/CuratedProductsSection.tsx`

```tsx
export default function CuratedProductsSection({ settings, sections, className }: CuratedProductsSectionProps) {
  const isActive = settings?.is_active === true && sections.length > 0;
  ...
  return (
    <SectionBlock ...>
      <SectionHeader ... action={<Link href="/recommended">...</Link>} />
      <div className="...">
        {sections.map((sec) => (
          <CuratedSectionScrollBlock key={sec.id} section={sec} showTitle={hasMultipleSections} />
        ))}
      </div>
    </SectionBlock>
  );
}
```

### 랜딩 히어로 계열: `src/components/landing/HeroVisual.tsx` · `LandingDetailHero.tsx`

- `HeroVisual`: 이미지 백드롭 + 오버레이 + children 슬롯.
- `LandingDetailHero`: `HeroVisual` + 제목/설명.

---

## 7. 공개 데이터 로드 · 허브 링크

### `src/lib/homeCurated.ts`

- `getHomeCuratedData()` — `unstable_cache` + `CACHE_TAGS.HOME_CURATED`
- `getRecommendedSectionBySlug` / `getRecommendedSectionBySlugForPublicLanding` — **slug·landing_enabled** 확장 포인트

### `src/lib/hubLandingLinks.ts` (발췌)

```ts
export function getRecommendedLandingHref(section: HomeCuratedSection): string {
  const rawSlug = section.slug?.trim();
  const slug = rawSlug ? rawSlug.toLowerCase().replace(/\s+/g, "-") : "";
  if (slug && isRecommendedLandingEnabled(section)) {
    return `/recommended/${encodeURIComponent(slug)}`;
  }
  ...
}
```

### `src/lib/productTaxonomies.ts` (발췌)

```ts
export async function getHubDestinations(): Promise<ProductTaxonomy[]> {
  return getHubDestinationsCached();
}
export function buildRegionTree(destinations: ProductTaxonomy[]): RegionTreeNode[] { ... }
```

### `src/lib/guides.ts` (발췌)

```ts
export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  const s = slug?.trim();
  if (!s) return null;
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("is_published", true)
    .eq("slug", s)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeGuide(data as Record<string, unknown>);
}
```

---

## 8. Analytics · `/quote` 추적

### `src/lib/analytics/events.ts` (발췌)

```ts
export const ANALYTICS_EVENTS = {
  ...
  quote_page_view: "quote_page_view",
  quote_submit_click: "quote_submit_click",
  quote_submit_success: "quote_submit_success",
  ...
} as const;

export const ANALYTICS_SOURCES = {
  ...
  home_curated_section: "home_curated_section",
  home_curated_catalog_cta: "home_curated_catalog_cta",
  quote_page: "quote_page",
} as const;
```

### `src/lib/analytics/trackQuoteEvent.ts`

- `trackQuotePageView`, `trackQuoteSubmitClick`, `trackQuoteSubmitSuccess`

### `src/components/quote/QuotePageContent.tsx`

```tsx
export function QuotePageContent({ source, productSummary }: QuotePageContentProps) {
  const productId = source?.product_id?.trim() ?? "";
  useEffect(() => {
    trackQuotePageView(productId || undefined);
  }, [productId]);
  return (
    <>
      {productSummary && <QuoteSummaryCard ... />}
      <InquiryForm source={source} productIdForTracking={productId || undefined} />
    </>
  );
}
```

---

## 9. 관련 파일 인덱스 (추가 탐색)

| 영역 | 경로 예시 |
|------|-----------|
| 캐시 태그 | `src/lib/cacheTags.ts` (`HOME_CURATED`) |
| 허브 가시성 | `src/lib/hubVisibility.ts` |
| 가이드 홈 섹션 | `src/components/home/HomeGuideSection.tsx` |
| 상품 카드 그리드 | `src/components/products/ProductCardGridSection.tsx` |
| 큐레이션 블록 | `src/components/home/CuratedBlock.tsx`, `CuratedSectionScrollBlock.tsx` |

---

*문서 끝. 원문과 차이가 나면 소스 트리 기준을 따릅니다.*
