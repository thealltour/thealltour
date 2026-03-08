# 레이아웃 리팩토링 적용 후 현재 코드 발췌 (체감 변화 분석용)

실제 반영된 파일 기준. `max-w-*`, `mx-auto`, `px-*`, `grid-cols-*`, `gap-*`, `w-full`, `min-w-0`, `rounded-*`, `bg-*`, `ring-*` 등 레이아웃 관련 className은 생략 없이 포함.

---

## 1) 홈 페이지 — `src/app/page.tsx`

**return 전체 중 `SiteHeader` 아래 `<main>` 시작 ~ 홈 마지막 주요 section(contact) 끝까지**

```tsx
      <SiteHeader />

      <main className="page-content flex w-full flex-col py-8 md:py-10">
        <PageContainer size="wide" className="flex flex-col gap-16 md:gap-20">
          {/* 추천여행 */}
          {curatedSettings?.is_active === true && curatedSections.length > 0 ? (
            <SectionBlock surface="none" padding="md">
              <SectionHeader ... />
              <div className="space-y-8">
                {curatedSections.map((sec) => (
                  <CuratedBlock key={sec.id} ... />
                ))}
                <div className="pt-2"><Link ... /></div>
              </div>
            </SectionBlock>
          ) : (
            <SectionBlock surface="card" padding="md">
              <p className="type-small text-[var(--text-muted)]">...</p>
            </SectionBlock>
          )}

        <section className="relative overflow-hidden rounded-2xl bg-[var(--hero-bg)] py-8 ... sm:rounded-3xl sm:py-12 ... sm:ring-1 sm:ring-[var(--border)] md:py-20">
          {/* Hero 이미지/스크림/그리드 */}
          <div className="grid gap-10 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1.05fr)] md:items-center">
            ...
          </div>
        </section>

        <SectionBlock surface="muted" padding="lg">
          <div className="mb-8 space-y-3 text-center">
            <p className="mx-auto max-w-2xl type-small text-[var(--text-muted)]">...</p>
          </div>
          <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-7 lg:grid-cols-4">
            {/* 신뢰 4카드 */}
          </div>
        </SectionBlock>

        <SectionBlock surface="muted" padding="lg">
          <SectionHeader eyebrow="THEALL TOUR PREMIUM" title="품격 있는 골프 컬렉션" ... />
          <div className="space-y-8">
          <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-3 md:gap-6">
            {/* 골프 3종 + 전체 패키지 링크 */}
          </div>
          <Link ...>전체 패키지 상품 보기</Link>
        </div>
        </SectionBlock>

        <SectionBlock id="contact" surface="muted" padding="lg" className="md:px-12">
          <div className="grid items-start gap-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)]">
            ...
          </div>
        </SectionBlock>

        </PageContainer>
      </main>
```

**레이아웃 관련 className 요약 (홈)**  
- `main`: `page-content flex w-full flex-col py-8 md:py-10` (좌우 패딩 없음)  
- `PageContainer`: `size="wide"` → 내부에서 `mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8 xl:px-10` 적용  
- Hero section: `rounded-2xl ... sm:rounded-3xl`, `bg-[var(--hero-bg)]`, `sm:ring-1 sm:ring-[var(--border)]`  
- SectionBlock(muted): `bg-[var(--surface-muted)] ring-1 ring-[var(--border)]`, `rounded-2xl sm:rounded-3xl`, `p-6 sm:p-8 md:p-10` (lg)  
- 그리드: `md:grid-cols-2 md:gap-7 lg:grid-cols-4`, `md:grid-cols-3 md:gap-6`, `gap-10`, `gap-16 md:gap-20`  
- contact: `md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)]`, `gap-10`

---

## 2) 상품 목록 페이지

### 2-1. `src/app/products/page.tsx`

```tsx
  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] ...">
      <SiteHeader ... />

      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-8">
          <ProductsHero variant={...} />
          {products.length === 0 ? (
            <section className="rounded-2xl bg-[var(--surface)] p-8 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] ... sm:rounded-3xl">
              ...
            </section>
          ) : (
            <ProductsPageContent ... />
          )}
        </PageContainer>
      </main>
    </div>
  );
```

**레이아웃 관련**  
- `main`: `flex w-full flex-col py-6 sm:py-10 md:py-14` (좌우 패딩 없음)  
- `PageContainer`: `size="wide"` → `max-w-[1440px]`, `px-4 sm:px-6 lg:px-8 xl:px-10`, `mx-auto w-full`

### 2-2. `src/components/products/ProductsPageContent.tsx`

```tsx
  return (
    <div className="flex gap-8 items-start">
      <ProductFilterSidebar ... />
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-center gap-2 lg:hidden">...</div>
        <ProductFilterChips ... />
        <ProductCatalogSection ... />
      </div>
      <MobileProductFilterDrawer ... />
      <MobileProductSortSheet ... />
    </div>
  );
```

**레이아웃 관련**  
- 루트: `flex gap-8 items-start`  
- 결과 영역: `min-w-0 flex-1 space-y-4`

### 2-3. `src/components/ProductCatalogSection.tsx` (return·레이아웃 관련만)

```tsx
  return (
    <section className="space-y-5">
      <div className="sticky top-[76px] z-20 rounded-2xl bg-[var(--surface)]/95 p-4 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] backdrop-blur sm:rounded-3xl sm:p-5">
        <div className="space-y-4">...</div>
        <div className="mt-4 flex flex-wrap items-center gap-2">...</div>
        <div className="mt-4 flex flex-wrap items-center gap-2">...</div>
      </div>
      <div key={...} className="fade-in-up space-y-6">
        ...
        <div className="flex flex-col space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-8">
          {group.products.map(...)}
        </div>
      </div>
    </section>
  );
```

**레이아웃 관련**  
- Sticky toolbar: `rounded-2xl ... sm:rounded-3xl`, `bg-[var(--surface)]/95`, `ring-1 ring-[var(--border)]`, `p-4 ... sm:p-5`, `gap-2`  
- 결과 그리드: `md:grid-cols-2 md:gap-8`, `space-y-4`, `space-y-6`

### 2-4. `src/components/products/ProductFilterSidebar.tsx`

```tsx
  return (
    <aside
      className={cn(
        "hidden lg:block w-64 shrink-0 space-y-6",
        className,
      )}
      aria-label="상품 필터"
    >
      <div className="sticky top-24 space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
        ...
      </div>
    </aside>
  );
```

**레이아웃 관련**  
- aside: `w-64 shrink-0`, `space-y-6`  
- sticky 카드: `rounded-2xl`, `border border-[var(--border)]`, `bg-[var(--surface)]`, `p-5`

---

## 3) 상품 상세 페이지

### 3-1. `src/app/products/[id]/page.tsx` (return 부분)

```tsx
  return (
    <ConsultModalProvider>
      <ProductQuoteProvider>
      <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white py-6 sm:py-10 md:py-14">
        <PageContainer size="default">
          <main className="w-full">
            <div className="mb-6 md:hidden"><Link href="/products">← 상품 목록으로</Link></div>
            <div className="flex gap-8 xl:gap-10 lg:items-start">
              <div className="min-w-0 flex-1 space-y-6">
                <section className="overflow-hidden rounded-none bg-transparent shadow-none ring-0 sm:rounded-3xl sm:bg-white sm:shadow-md sm:ring-1 sm:ring-[#dbeafe]">
                  <div className="p-0 sm:p-6 md:p-8">
                    <ProductDetailV2 ... />
                  </div>
                </section>
                <ProductReviewsSection ... />
                <AlertCard ... />
              </div>
              <ProductDetailStickyV2Desktop ... />
            </div>
          </main>
        </PageContainer>
        <ProductDetailStickyV2Mobile ... />
      </div>
      </ProductQuoteProvider>
    </ConsultModalProvider>
  );
```

**레이아웃 관련**  
- 바깥 div: `py-6 sm:py-10 md:py-14` (좌우 패딩 없음)  
- `PageContainer`: `size="default"` → `max-w-[1280px]`, `px-4 sm:px-6 lg:px-8 xl:px-10`, `mx-auto w-full`  
- main: `w-full`  
- 본문+사이드바: `flex gap-8 xl:gap-10 lg:items-start`  
- 본문: `min-w-0 flex-1 space-y-6`  
- 상세 section: `rounded-none ... sm:rounded-3xl`, `sm:bg-white`, `sm:ring-1 sm:ring-[#dbeafe]`, `p-0 sm:p-6 md:p-8`

### 3-2. `ProductDetailV2` (return 상단 ~ 첫 section 끝)

```tsx
  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">...</div>
        <h1 className="...">...</h1>
        ...
        <ProductImageCarousel ... />
        <Card variant="default" className="border-[#dbeafe] bg-[#f8fbff] p-5 ring-[#dbeafe] md:hidden">...</Card>
        ...
      </section>
      <TravelOverviewV2 ... />
      <section>
        <Tabs ... className="mb-4 flex flex-wrap gap-2">...</Tabs>
        ...
      </section>
    </div>
  );
```

**레이아웃 관련**  
- 루트: `space-y-8`  
- Hero section: `space-y-5`, `gap-2`, `gap-3`, `flex flex-wrap gap-2`

### 3-3. `ProductDetailStickyV2Desktop` (전체 return)

```tsx
  return (
    <aside
      className="hidden md:block sticky top-24 w-full max-w-[300px] shrink-0 space-y-4"
      aria-label="상품 요약"
    >
      <Link href="/products" className="... rounded-lg border ... px-4 py-2 ...">← 상품 목록으로</Link>
      {seoHashtags.length > 0 && (
        <div className="rounded-2xl border border-[#dbeafe] bg-white p-4 shadow-lg ring-1 ring-[#dbeafe]">...</div>
      )}
      {chart && (
        <div className="rounded-2xl border border-[#dbeafe] bg-white p-4 shadow-lg ring-1 ring-[#dbeafe]">...</div>
      )}
      <div className="rounded-2xl border border-[#dbeafe] bg-white p-5 shadow-lg ring-1 ring-[#dbeafe]">
        ...
      </div>
    </aside>
  );
```

**레이아웃 관련**  
- aside: `w-full max-w-[300px] shrink-0`, `space-y-4`  
- 내부 카드: `rounded-2xl`, `border border-[#dbeafe]`, `bg-white`, `ring-1 ring-[#dbeafe]`, `p-4` / `p-5`

---

## 4) 공통 레이아웃 컴포넌트 전체

### 4-1. `src/components/layout/PageContainer.tsx`

```tsx
"use client";

import { cn } from "@/lib/cn";

export type PageContainerSize = "reading" | "default" | "wide" | "full";

export type PageContainerProps = {
  children: React.ReactNode;
  size?: PageContainerSize;
  className?: string;
};

const SIZE_CLASS: Record<PageContainerSize, string> = {
  reading: "max-w-[1040px]",
  default: "max-w-[1280px]",
  wide: "max-w-[1440px]",
  full: "max-w-none",
};

export function PageContainer({ children, size = "default", className }: PageContainerProps) {
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

**실제 적용값**  
- `max-w-*`: reading 1040px, default 1280px, wide 1440px, full none  
- `mx-auto w-full`, `px-4 sm:px-6 lg:px-8 xl:px-10`

### 4-2. `src/components/layout/SectionBlock.tsx`

```tsx
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

// return
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
```

**실제 적용값**  
- `rounded-*`: padding !== "none" 일 때 `rounded-2xl sm:rounded-3xl`  
- `bg-*`: none → transparent, muted → `bg-[var(--surface-muted)]`, card → `bg-[var(--surface)]`  
- `ring-*`: muted/card → `ring-1 ring-[var(--border)]`  
- `gap`/spacing: `space-y-6`, padding sm/md/lg

### 4-3. `src/components/layout/SectionHeader.tsx`

```tsx
  return (
    <div className={cn("space-y-2", alignClass, className)}>
      {hasTop ? (
        <div className="space-y-2">
          {eyebrow ? <p className="section-label text-[var(--text-muted)]">{eyebrow}</p> : null}
          {title ? <h2 className="heading-display section-title type-h2 text-[var(--foreground)]">{title}</h2> : null}
          {description ? <p className="type-small text-[var(--text-muted)]">{description}</p> : null}
        </div>
      ) : null}
      {action ? <div className={cn(hasTop && "pt-1")}>{action}</div> : null}
    </div>
  );
```

- 레이아웃: `space-y-2`, `text-left` / `text-center`

### 4-4. `src/components/layout/ContentContainer.tsx`

```tsx
export function ContentContainer({ children, className, size = "default" }: ContentContainerProps) {
  return (
    <PageContainer size={size} className={cn(className)}>
      {children}
    </PageContainer>
  );
}
```

- PageContainer 위임, `size` 기본값 `default` → `max-w-[1280px]` + 동일 px

---

## 5) 홈 추천 관련 컴포넌트 전체

### 5-1. `src/components/home/CuratedBlock.tsx`

```tsx
const SURFACE_CLASS: Record<CuratedBlockSurface, string> = {
  none: "",
  muted: "rounded-2xl bg-[var(--surface-muted)] ring-1 ring-[var(--border)] p-5 sm:p-6",
  card: cn(CARD_BASE, CARD_PADDING_RELAXED),
};

export default function CuratedBlock({ title, description, products, surface = "none" }: CuratedBlockProps) {
  if (!products || products.length === 0) return null;
  return (
    <section className={cn("space-y-4", SURFACE_CLASS[surface])}>
      <SectionHeader title={title} description={description} className="[&_.section-title]:!text-[1.375rem] ..." />
      <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", CARD_GRID_GAP)}>
        {products.map((product) => (
          <CuratedProductCard key={product.id} product={product} sectionTitle={title} />
        ))}
      </div>
    </section>
  );
}
```

**실제 적용값**  
- surface=none: `space-y-4`만  
- grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`, `CARD_GRID_GAP` = `gap-4`  
- card 토큰: `CARD_BASE` = `rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]`, `CARD_PADDING_RELAXED` = `p-5`

### 5-2. `src/components/home/CuratedProductCard.tsx`

```tsx
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden",
        CARD_BASE,
        CARD_HOVER,
        CARD_TRANSITION,
      )}
      ...
    >
      <div className={cn(CARD_IMAGE_WRAPPER, "h-36 sm:h-40")}>
        <Image ... />
        ...
      </div>
      <div className={cn("relative flex flex-1 flex-col", CARD_PADDING)}>
        ...
      </div>
    </Link>
  );
```

**실제 적용값**  
- CARD_BASE: `rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]`  
- CARD_HOVER: `hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-soft-strong)]`  
- CARD_IMAGE_WRAPPER: `relative w-full overflow-hidden`, 이미지 높이 `h-36 sm:h-40`  
- CARD_PADDING: `p-4`

### 5-3. `src/lib/cardTokens.ts` (참고)

```ts
export const CARD_BASE =
  "rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]";
export const CARD_HOVER =
  "hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-soft-strong)]";
export const CARD_TRANSITION = "transition-all duration-200 ease-out";
export const CARD_PADDING = "p-4";
export const CARD_PADDING_RELAXED = "p-5";
export const CARD_IMAGE_WRAPPER = "relative w-full overflow-hidden";
export const CARD_GRID_GAP = "gap-4";
export const CARD_GRID_GAP_RELAXED = "gap-6";
```

---

## 6) 폭/간격/스타일 변경 요약

| 항목 | 홈 (리팩 후) | 상품 목록 (리팩 후) | 상품 상세 (리팩 후) |
|------|----------------|----------------------|----------------------|
| **max-w** | PageContainer `wide` → **max-w-[1440px]** | 동일 **max-w-[1440px]** | PageContainer `default` → **max-w-[1280px]** |
| **mx-auto** | PageContainer 내부 | PageContainer 내부 | PageContainer 내부 |
| **px** | PageContainer: **px-4 sm:px-6 lg:px-8 xl:px-10** | 동일 | 동일 |
| **main 직접 px** | 없음 (과거 px-3 sm:px-6 md:px-10 제거) | 없음 (과거 px-3 sm:px-6 md:px-10 제거) | 없음 |
| **grid-cols** | 2/3/4열, gap-6~10, gap-16/20 | 목록 2열 md:gap-8 | 상세 본문 그리드 없음 (flex 1+sticky) |
| **gap** | gap-16 md:gap-20, gap-8, gap-10, gap-4, gap-6, gap-7 | gap-8, gap-2, gap-8(그리드) | gap-8 xl:gap-10 |
| **w-full** | main, PageContainer | main, PageContainer | main, PageContainer, aside(sticky) |
| **min-w-0** | — | 결과 영역 `min-w-0 flex-1` | 본문 `min-w-0 flex-1` |
| **rounded** | rounded-2xl, sm:rounded-3xl (SectionBlock, Hero) | rounded-2xl, sm:rounded-3xl | sm:rounded-3xl(본문), rounded-2xl(sticky) |
| **bg** | bg-transparent, hero-bg, surface-muted, surface | surface, surface-muted | white, #f3f8ff, #f8fbff, #dbeafe 등 |
| **ring** | ring-1 ring-[var(--border)], sm:ring-[#dbeafe] 등 | ring-1 ring-[var(--border)] | ring-1 ring-[#dbeafe] |

---

## 7) 브라우저 개발자도구 측정값 (확인용)

실제 체감 폭을 보려면 개발자도구에서 아래 요소의 **computed width (또는 getBoundingClientRect().width)** 를 측정하면 됩니다.

| 측정 대상 | 예상 계산 (코드 기준) | 실제 측정값 (직접 입력) |
|-----------|------------------------|-------------------------|
| **홈 main** | viewport − (스크롤바) → 내부는 PageContainer가 제한. **내부 콘텐츠 폭** = min(1440, viewport − 0) − (px-4~10×2) |  |
| **홈 추천 섹션** | PageContainer와 동일 폭. **실제 콘텐츠 영역** = min(1440, viewport) − 좌우 padding (px-4 ~ xl:px-10) |  |
| **상품 목록 main** | 동일. **min(1440, viewport)** − 좌우 padding |  |
| **상품 상세 main** | **min(1280, viewport)** − 좌우 padding (default 컨테이너) |  |

- **홈/목록**: `PageContainer size="wide"` → max-width 1440px, padding `px-4 sm:px-6 lg:px-8 xl:px-10`  
  - 1440px 이상 뷰포트에서: 콘텐츠 폭 = 1440 − (lg: 32px, xl: 40px 등)  
- **상세**: `PageContainer size="default"` → max-width 1280px, 동일 padding  
  - 1280px 이상 뷰포트에서: 콘텐츠 폭 = 1280 − padding  

**측정 방법 예시**  
1. 해당 페이지 로드 후 개발자도구(Elements)에서 `<main>` 또는 `PageContainer` div 선택  
2. Computed 탭에서 `width` 확인 또는 Console에서 `document.querySelector('main')?.getBoundingClientRect().width` 실행  
3. 추천 섹션은 해당 `SectionBlock` 또는 그 내부 `div.space-y-8` 등 동일한 컨테이너 하위 요소로 측정  

위 표의 “실제 측정값” 열은 브라우저에서 측정한 값으로 채우면 체감 변화 원인 분석에 활용할 수 있습니다.
