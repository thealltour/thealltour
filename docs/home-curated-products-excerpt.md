# 홈 추천상품 섹션 코드 발췌문

모바일 홈 추천상품 카드 스크롤 개선을 위한 수정 전 분석용 발췌.  
수정은 하지 않고, 관련 파일/함수 코드만 발췌해 두었습니다.

---

## 1. 홈의 추천상품 섹션 진입 파일

**파일: `src/app/page.tsx`**

```tsx
import { ShieldCheck, Users, Route, CheckCircle2 } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { getHomeCuratedData } from "@/lib/homeCurated";
// ... (getHomeBanners, getHeroContent, getHubDestinations, getHubThemes, getSiteSettings, getHomeGuidesWithTaxonomyNames, getTopRatedPublishedReviews)
import CuratedProductsSection from "@/components/home/CuratedProductsSection";
// ...

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
  // ...

  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
        <main className="flex w-full flex-col pt-4 pb-6 sm:py-10 md:py-14">
          <HeroSection ... />
          <PageContainer size="wide" className="flex flex-col gap-12 md:gap-20">
            <DestinationSection items={destinationsForHome} />
            <ThemeSection items={themesForHome} />
            <CuratedProductsSection settings={curatedSettings} sections={curatedSections} />
            <HomeGuideSection guides={homeGuides} />
            <HomeReviewSection reviews={homeReviews} />
            // ... Trust, Contact 섹션
          </PageContainer>
        </main>
      </div>
    </>
  );
}
```

- 추천상품 섹션은 **`CuratedProductsSection`** 한 곳에서만 렌더링됩니다.
- `getHomeCuratedData()`로 `curatedSettings`, `curatedSections`를 받아 `settings` / `sections`로 넘깁니다.

---

## 2. 추천상품 섹션 컴포넌트 전체

**파일: `src/components/home/CuratedProductsSection.tsx`**

```tsx
import Link from "next/link";
import CuratedBlock from "@/components/home/CuratedBlock";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import type {
  HomeCuratedSettings,
  HomeCuratedSectionWithProducts,
} from "@/types/homeCurated";

export type CuratedProductsSectionProps = {
  settings: HomeCuratedSettings | null;
  sections: HomeCuratedSectionWithProducts[];
  className?: string;
};

export default function CuratedProductsSection({
  settings,
  sections,
  className,
}: CuratedProductsSectionProps) {
  const isActive = settings?.is_active === true && sections.length > 0;

  if (isActive) {
    return (
      <SectionBlock surface="none" padding="md" className={className}>
        <SectionHeader
          eyebrow={settings!.section_label}
          title={settings!.section_title}
          description={settings!.section_description}
        />
        <div className="space-y-8">
          {sections.map((sec) => (
            <CuratedBlock
              key={sec.id}
              title={sec.title}
              description={sec.description}
              products={sec.products}
            />
          ))}
          <div className="pt-2">
            <Link
              href={settings!.catalog_button_href}
              className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
            >
              {settings!.catalog_button_label}
            </Link>
          </div>
        </div>
      </SectionBlock>
    );
  }

  return (
    <SectionBlock surface="card" padding="md" className={className}>
      <p className="type-small text-[var(--text-muted)]">
        메인 추천 상품이 없습니다. 관리자 페이지에서 추천 상품을 체크해 주세요.
      </p>
    </SectionBlock>
  );
}
```

**파일: `src/components/home/CuratedBlock.tsx`**

```tsx
import type { Product } from "@/types/product";
import { cn } from "@/lib/cn";
import { SectionHeader } from "@/components/layout/SectionHeader";
import CuratedProductCard from "@/components/home/CuratedProductCard";
import { CARD_BASE, CARD_PADDING_RELAXED } from "@/lib/cardTokens";

export type CuratedBlockSurface = "none" | "muted" | "card";

export type CuratedBlockProps = {
  title: string;
  description: string;
  products: Product[];
  surface?: CuratedBlockSurface;
};

const SURFACE_CLASS: Record<CuratedBlockSurface, string> = {
  none: "",
  muted: "rounded-2xl bg-[var(--surface-muted)] ring-1 ring-[var(--border)] p-5 sm:p-6",
  card: cn(CARD_BASE, CARD_PADDING_RELAXED),
};

export default function CuratedBlock({
  title,
  description,
  products,
  surface = "none",
}: CuratedBlockProps) {
  if (!products || products.length === 0) return null;

  return (
    <section className={cn("space-y-4", SURFACE_CLASS[surface])}>
      <SectionHeader
        title={title}
        description={description}
        className="[&_.section-title]:!text-[1.375rem] [&_.section-title]:!font-card-title [&_.section-title]:!font-semibold"
      />

      <div className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        "gap-3 sm:gap-4",
      )}>
        {products.map((product) => (
          <CuratedProductCard key={product.id} product={product} sectionTitle={title} />
        ))}
      </div>
    </section>
  );
}
```

- 홈 추천상품 목록을 실제로 그리는 건 **CuratedProductsSection → CuratedBlock → CuratedProductCard** 한 줄기만 있습니다.
- ProductSection / FeaturedProductsSection / ProductCarousel 등 다른 이름의 컴포넌트는 이 경로에 없습니다.

---

## 3. 추천상품 카드 컴포넌트 전체

**파일: `src/components/home/CuratedProductCard.tsx`**

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/types/product";
import { getProductBadges } from "@/lib/productCategory";
import { trackProductCardClick } from "@/lib/analytics/trackProductClick";
import {
  CARD_BASE,
  CARD_HOVER,
  CARD_TRANSITION,
  CARD_PADDING,
  CARD_IMAGE_WRAPPER,
} from "@/lib/cardTokens";
import { cn } from "@/lib/cn";

export type CuratedProductCardProps = {
  product: Product;
  sectionTitle?: string | null;
};

export default function CuratedProductCard({ product, sectionTitle }: CuratedProductCardProps) {
  const badges = getProductBadges(product);
  const href = `/products/${product.id}`;

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden",
        CARD_BASE,
        CARD_HOVER,
        CARD_TRANSITION,
      )}
      onClick={() =>
        trackProductCardClick({
          productId: product.id,
          productTitle: product.title ?? "",
          href,
          source: "home_curated",
          section: sectionTitle ?? undefined,
        })
      }
    >
      <div className={cn(CARD_IMAGE_WRAPPER, "h-32 sm:h-36")}>
        <Image
          src={product.image_url ?? ""}
          alt={`${product.title ?? "상품"} 대표 이미지`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--overlay)] via-[var(--overlay)]/20 to-transparent" />
        <div className="absolute inset-0 overlay-radial-blue-subtle opacity-80 transition-opacity group-hover:opacity-100" />
      </div>
      <div className={cn("relative flex flex-1 flex-col", CARD_PADDING)}>
        {/* 태그: 카테고리·배지 */}
        <div className="flex flex-wrap items-center gap-1.5 section-label">
          {product.category ? (
            <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 type-caption text-[var(--text-muted)] ring-1 ring-[var(--border)]">
              {product.category}
            </span>
          ) : null}
          {badges.map((badge) => (
            <span
              key={`${product.id}-${badge}`}
              className="rounded-full bg-[var(--surface-muted)] px-2 py-1 text-[10px] text-[var(--foreground)] ring-1 ring-[var(--border)]"
            >
              {badge}
            </span>
          ))}
        </div>
        {/* 제목 */}
        <h5 className="font-card-title mt-1 line-clamp-2 type-small font-semibold text-[var(--foreground)]">
          {product.title ?? "상품명"}
        </h5>
        {/* 테마/한줄: 1줄 */}
        {product.theme ? (
          <p className="mt-0.5 line-clamp-1 type-caption text-[var(--text-muted)]">
            {product.theme}
          </p>
        ) : null}
        {/* 설명: 1줄로 밀도 확보 */}
        <p className="mt-0.5 line-clamp-1 type-caption text-[var(--text-muted)]">
          {product.description ?? ""}
        </p>
        {/* 가격: 하단 고정 */}
        {typeof product.price === "number" ? (
          <p className="font-price-strong mt-1.5 type-caption font-semibold text-[var(--primary)]">
            예상가 {new Intl.NumberFormat("ko-KR").format(product.price)}원~
          </p>
        ) : null}
      </div>
    </Link>
  );
}
```

- 홈 추천상품에서 쓰는 카드는 **CuratedProductCard** 하나뿐이며, ProductCardV2 / FeaturedProductCard 등은 이 섹션에서 사용하지 않습니다.

---

## 4. 카드 이미지 렌더링 관련 코드

**CuratedProductCard.tsx 내 이미지·오버레이 부분:**

```tsx
      <div className={cn(CARD_IMAGE_WRAPPER, "h-32 sm:h-36")}>
        <Image
          src={product.image_url ?? ""}
          alt={`${product.title ?? "상품"} 대표 이미지`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--overlay)] via-[var(--overlay)]/20 to-transparent" />
        <div className="absolute inset-0 overlay-radial-blue-subtle opacity-80 transition-opacity group-hover:opacity-100" />
      </div>
```

**파일: `src/lib/cardTokens.ts` (이미지 래퍼)**

```ts
/** 카드 이미지 영역 공통 */
export const CARD_IMAGE_WRAPPER = "relative w-full overflow-hidden";
```

- Next/Image: `fill` + `object-cover`, 고정 높이 `h-32 sm:h-36` (128px / 144px).
- 오버레이: 하단 그라데이션 + `overlay-radial-blue-subtle` (globals.css 정의).
- 텍스트/배지 오버레이는 이미지 위가 아니라 카드 본문(태그·제목·가격) 영역에만 있습니다.

---

## 5. 카드 정보 영역 전체

- 위 **3번** CuratedProductCard.tsx 55~94줄이 카드 정보 영역 전체입니다.
- **태그/배지**: `product.category` + `getProductBadges(product)` → `rounded-full` 칩
- **제목**: `h5`, `line-clamp-2`, `type-small`, `font-card-title`
- **테마**: `product.theme` 1줄 `line-clamp-1`
- **설명**: `product.description` 1줄 `line-clamp-1`
- **가격**: `product.price` 숫자일 때만 "예상가 N원~", `font-price-strong`, `type-caption`
- **CTA**: 카드 전체가 `Link`라서 별도 버튼 없음. footer 전용 마크업 없음.

---

## 6. 추천상품 데이터 소스

**파일: `src/lib/homeCurated.ts`**

```ts
async function getHomeCuratedDataUncached(): Promise<HomeCuratedData> {
  try {
    const { data: settingRow, error: settingError } = await supabase
      .from("home_curated_settings")
      .select("*")
      .eq("setting_key", "home_curated")
      .maybeSingle();

    if (settingError || !settingRow) {
      return { settings: null, sections: [] };
    }

    const settings = normalizeSettings(settingRow as Record<string, unknown>);
    if (!settings.is_active) {
      return { settings, sections: [] };
    }

    const { data: sectionRows, error: sectionsError } = await supabase
      .from("home_curated_sections")
      .select("*")
      .eq("setting_id", settings.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (sectionsError || !sectionRows?.length) {
      return { settings, sections: [] };
    }

    const sections = sectionRows.map((r) => normalizeSection(r as Record<string, unknown>));
    const sectionIds = sections.map((s) => s.id);

    const { data: spRows, error: spError } = await supabase
      .from("home_curated_section_products")
      .select("id, section_id, product_id, sort_order")
      .in("section_id", sectionIds)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (spError || !spRows?.length) {
      return {
        settings,
        sections: sections.map((s) => ({ ...s, products: [] })),
      };
    }

    const productIds = [...new Set(spRows.map((r) => String(r.product_id)))];
    const { data: productRows, error: productsError } = await supabase
      .from("products")
      .select("*")
      .in("id", productIds)
      .eq("is_active", true);

    const productMap = new Map<string, ReturnType<typeof normalizeProduct>>();
    if (!productsError && productRows?.length) {
      for (const row of productRows) {
        const p = normalizeProduct(row as Record<string, unknown>);
        productMap.set(p.id, p);
      }
    }

    const sectionProductsBySection = new Map<string, Array<{ product_id: string }>>();
    for (const sp of spRows) {
      const sid = String(sp.section_id);
      if (!sectionProductsBySection.has(sid)) {
        sectionProductsBySection.set(sid, []);
      }
      sectionProductsBySection.get(sid)!.push({ product_id: String(sp.product_id) });
    }

    const sectionsWithProducts: HomeCuratedSectionWithProducts[] = sections.map((sec) => {
      const order = sectionProductsBySection.get(sec.id) ?? [];
      const products = order
        .map((o) => productMap.get(o.product_id))
        .filter((p): p is NonNullable<typeof p> => p != null)
        .slice(0, sec.max_items);
      return { ...sec, products };
    });

    return { settings, sections: sectionsWithProducts };
  } catch {
    return { settings: null, sections: [] };
  }
}

export async function getHomeCuratedData(): Promise<HomeCuratedData> {
  return unstable_cache(getHomeCuratedDataUncached, ["home-curated-data"], {
    revalidate: 60,
    tags: [CACHE_TAGS.HOME_CURATED],
  })();
}
```

**설정/섹션 정규화 (동일 파일):**

```ts
function normalizeSettings(row: Record<string, unknown>): HomeCuratedSettings {
  return {
    id: String(row.id ?? ""),
    setting_key: String(row.setting_key ?? ""),
    section_label: String(row.section_label ?? ""),
    section_title: String(row.section_title ?? ""),
    section_description: String(row.section_description ?? ""),
    catalog_button_label: String(row.catalog_button_label ?? ""),
    catalog_button_href: String(row.catalog_button_href ?? "/products"),
    is_active: row.is_active === true,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

function normalizeSection(row: Record<string, unknown>): HomeCuratedSection {
  return {
    id: String(row.id ?? ""),
    setting_id: String(row.setting_id ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    max_items: typeof row.max_items === "number" ? Math.max(0, row.max_items) : 8,
    is_active: row.is_active === true,
    slug: ...,
    landing_enabled: ...,
    created_at: ...,
  };
}
```

- **기준**: 관리자가 만든 **home_curated** 설정 1건 + **home_curated_sections** + **home_curated_section_products**로 "어떤 섹션에 어떤 상품을 몇 개까지" 지정. 인기/추천 플래그나 category/theme/product line으로 자동 필터링하는 구조는 없고, 전부 "섹션–상품 매핑 테이블 + sort_order"입니다.
- **상품**: `products` 테이블에서 위 product_id들만 `is_active=true`로 조회 후 `normalizeProduct`로 Product 타입으로 변환합니다.

**파일: `src/lib/products.ts` (normalizeProduct 발췌)**

```ts
export function normalizeProduct(row: Record<string, unknown>): Product {
  // ...
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? row.name ?? "상품명 미정"),
    description: String(row.description ?? row.content ?? "상세 설명이 준비 중입니다."),
    image_url: primaryImage,
    images_json: ...,
    category: String(row.category ?? row.type ?? "여행상품"),
    theme: typeof row.theme === "string" ? row.theme : undefined,
    // ... destination_id, product_line_id, campaigns, tags, price, duration, ...
  };
}
```

- mock/별도 mapper 없이, Supabase 조회 + `normalizeProduct`가 전부입니다.

---

## 7. 레이아웃 래퍼

**페이지 레벨:**

- `PageContainer size="wide"` → `max-w-[1600px]`, `px-4 sm:px-6 lg:px-8 xl:px-10`, `flex flex-col gap-12 md:gap-20`.

**파일: `src/components/layout/SectionBlock.tsx`**

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

- 추천상품 섹션: `SectionBlock surface="none" padding="md"` → `p-5 sm:p-6 md:p-8`, `space-y-6`, 배경 없음.

**CuratedProductsSection 내부:**

- `space-y-8` → 그 안에 CuratedBlock들이 세로로 쌓임.
- 각 **CuratedBlock** 내부 그리드:
  - `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
  - `gap-3 sm:gap-4`
- swiper, embla, overflow-x-auto 등 가로 스크롤/캐러셀 코드는 **추천상품 섹션/카드 쪽에는 없습니다**.

**파일: `src/components/layout/PageContainer.tsx`**

```tsx
const SIZE_CLASS: Record<PageContainerSize, string> = {
  reading: "max-w-[1040px]",
  default: "max-w-[1280px]",
  wide: "max-w-[1600px]",
  full: "max-w-none",
};

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

---

## 8. 스타일 영향 범위

- 추천상품 카드는 **Tailwind + globals.css 유틸 클래스**만 사용합니다. 전용 CSS 파일/모듈은 없습니다.

**파일: `src/app/globals.css` (추천 카드에서 쓰는 부분만)**

```css
  --type-small-size: 0.875rem; /* 14px */
  --type-small-weight: 400;
  --type-small-leading: 1.6;
  --type-caption-size: 0.75rem; /* 12px */
  --type-caption-weight: 400;
  --type-caption-leading: 1.4;
```

```css
.overlay-radial-gold {
  background-image: radial-gradient(circle at top, var(--overlay-accent-gold) 0%, transparent 60%);
}
.overlay-radial-blue {
  background-image: radial-gradient(circle at top, var(--overlay-accent-blue) 0%, transparent 60%);
}
.overlay-radial-blue-subtle {
  background-image: radial-gradient(circle at top, var(--overlay-accent-blue-subtle) 0%, transparent 55%);
}
```

```css
.type-small {
  font-size: var(--type-small-size);
  font-weight: var(--type-small-weight);
  line-height: var(--type-small-leading);
  letter-spacing: var(--type-letter-tight);
}
.type-caption {
  font-size: var(--type-caption-size);
  font-weight: var(--type-caption-weight);
  line-height: var(--type-caption-leading);
  letter-spacing: var(--type-letter-tight);
}
.section-label {
  font-size: var(--type-caption-size);
  font-weight: 500;
  letter-spacing: 0.05em;
  color: var(--theall-text-muted);
}
```

```css
.font-card-title {
  font-family: var(--font-display-sans);
  font-weight: 600;
  letter-spacing: var(--type-letter-tight);
}
.font-price-strong {
  font-family: var(--font-sans-fallback);
  font-weight: 600;
  letter-spacing: var(--type-letter-tight);
}
```

**파일: `src/lib/cardTokens.ts` (카드 공통)**

```ts
export const CARD_BASE =
  "rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]";
export const CARD_HOVER =
  "hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-soft-strong)]";
export const CARD_TRANSITION = "transition-all duration-200 ease-out";
export const CARD_PADDING = "p-4";
export const CARD_PADDING_RELAXED = "p-5";
export const CARD_IMAGE_WRAPPER = "relative w-full overflow-hidden";
```

---

*이 문서는 모바일 홈 추천상품 카드 스크롤 길이 개선을 위한 수정 전 분석용으로 작성되었습니다.*
