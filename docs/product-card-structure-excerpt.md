# 상품 카드 구조 비교 발췌문

목적: 추천상품 카드 / 상품 목록 카드 / 검색 결과 카드 / 기타 상품 카드가 서로 **다른 구조인지 확인**하기 위함.  
코드는 **수정 없이 발췌**했으며, PR30 설계(카드 UI 통일) 참고용입니다.

---

## 1. 추천상품 카드 컴포넌트

**File:** `src/components/home/CuratedProductCard.tsx`

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/types/product";
import { getProductBadges } from "@/lib/productCategory";
import { trackProductCardClick } from "@/lib/analytics/trackProductClick";
import {
  CARD_BASE_HOME,
  CARD_HOVER,
  CARD_TRANSITION,
  CARD_IMAGE_WRAPPER,
  CARD_PADDING_HOME,
  CARD_IMAGE_ASPECT_HOME,
  CARD_TITLE_HOME,
  CARD_META_HOME,
  CARD_BADGE_HOME,
} from "@/lib/cardTokens";
import { cn } from "@/lib/cn";

export type CuratedProductCardProps = {
  product: Product;
  /** 상위 섹션 제목 (홈 추천 계측용) */
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
        CARD_BASE_HOME,
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
      <div className={cn(CARD_IMAGE_WRAPPER, "shrink-0 bg-[var(--surface-muted)]", CARD_IMAGE_ASPECT_HOME)}>
        <Image
          src={product.image_url ?? ""}
          alt={`${product.title ?? "상품"} 대표 이미지`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition duration-200 group-hover:scale-[1.02]"
        />
      </div>
      <div className={cn("relative flex flex-1 flex-col", CARD_PADDING_HOME)}>
        {/* 태그: 카테고리·배지 (최대 1개, 홈 카드 배지 스타일) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {product.category ? (
            <span className={cn(CARD_BADGE_HOME)}>
              {product.category}
            </span>
          ) : null}
          {badges.slice(0, 1).map((badge) => (
            <span key={`${product.id}-${badge}`} className={cn(CARD_BADGE_HOME, "text-[var(--foreground)]")}>
              {badge}
            </span>
          ))}
        </div>
        <h5 className={cn(CARD_TITLE_HOME, "mt-1 line-clamp-2")}>
          {product.title ?? "상품명"}
        </h5>
        {product.theme ? (
          <p className={CARD_META_HOME}>
            {product.theme}
          </p>
        ) : (
          <p className={CARD_META_HOME}>
            {product.description ?? ""}
          </p>
        )}
        {typeof product.price === "number" ? (
          <p className="mt-1.5 text-xs font-semibold text-[var(--primary)] md:type-caption font-price-strong">
            예상가 {new Intl.NumberFormat("ko-KR").format(product.price)}원~
          </p>
        ) : null}
      </div>
    </Link>
  );
}
```

---

## 2. 상품 목록 페이지 카드

- `ProductCard.tsx`: 레거시용. 목록에서는 feature flag 꺼져 있을 때만 인라인 마크업 또는 ProductCardV2 사용.
- `ProductCardV2.tsx`: **목록에서 실제 사용하는 카드** (feature flag 켜져 있을 때).
- `ProductListCard.tsx`: **없음**.

### 2-1. ProductCard (레거시)

**File:** `src/components/ProductCard.tsx`

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { Scale, Bookmark, Check, Info } from "lucide-react";
import Tag from "@/components/ui/Tag";
import {
  CARD_BASE,
  CARD_HOVER,
  CARD_TRANSITION,
  CARD_PADDING_RELAXED,
  CARD_IMAGE_WRAPPER,
} from "@/lib/cardTokens";
import { cn } from "@/lib/cn";

export type ProductCardTag = {
  label: string;
  variant: "accent" | "muted" | "gold";
};

export type ProductCardProps = {
  href: string;
  imageUrl: string;
  imageAlt: string;
  tags?: ProductCardTag[];
  title: string;
  description: string;
  price?: number;
  duration?: string;
  priceMeta?: string;
  fuelSurchargeIncluded?: boolean;
  hashtags?: string[];
  ctaLabel?: string;
  onCompareAdd?: (e: React.MouseEvent) => void;
  onBookmark?: (e: React.MouseEvent) => void;
  showCompareButton?: boolean;
  showBookmarkButton?: boolean;
};

export default function ProductCard({
  href,
  imageUrl,
  imageAlt,
  tags = [],
  title,
  description,
  price,
  duration,
  priceMeta = "1인 기준",
  fuelSurchargeIncluded,
  hashtags = [],
  ctaLabel = "상세 보기",
  onCompareAdd,
  onBookmark,
  showCompareButton = false,
  showBookmarkButton = false,
}: ProductCardProps) {
  const handleActionClick = (e: React.MouseEvent, fn?: (e: React.MouseEvent) => void) => {
    e.preventDefault();
    e.stopPropagation();
    fn?.(e);
  };

  const priceFormatted =
    typeof price === "number" ? new Intl.NumberFormat("ko-KR").format(price) : null;

  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full flex-col overflow-hidden",
        CARD_BASE,
        CARD_HOVER,
        CARD_TRANSITION,
        "hover:-translate-y-0.5",
      )}
    >
      {/* ImageArea */}
      <div className={cn(CARD_IMAGE_WRAPPER, "h-48 md:h-52")}>
        <Image
          src={imageUrl}
          alt={imageAlt}
          width={900}
          height={560}
          sizes="(max-width: 768px) 100vw, 50vw"
          loading="lazy"
          className={cn("h-full w-full object-cover", CARD_TRANSITION, "group-hover:scale-[1.03]")}
        />
        {/* 비교 추가 / 북마크: 우측 상단 액션 영역 */}
        {(showCompareButton || showBookmarkButton) && (
          <div className="absolute right-2 top-2 flex gap-1.5">
            {showCompareButton && (
              <button type="button" onClick={(e) => handleActionClick(e, onCompareAdd)} ...>비교 추가</button>
            )}
            {showBookmarkButton && (
              <button type="button" onClick={(e) => handleActionClick(e, onBookmark)} ...>찜하기</button>
            )}
          </div>
        )}
      </div>

      <div className={cn("flex flex-1 flex-col gap-3", CARD_PADDING_RELAXED)}>
        {/* BadgeRow */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <Tag key={tag.label} variant={tag.variant} size="sm">{tag.label}</Tag>
            ))}
          </div>
        )}
        <h2 className="font-card-title type-body font-semibold text-[var(--text-primary)] md:type-small line-clamp-2">{title}</h2>
        <p className="line-clamp-1 type-small leading-6 text-[var(--text-muted)]">{description}</p>
        <div className="space-y-1">
          {priceFormatted !== null && (
            <p className="font-price-strong type-body font-bold text-[var(--primary)]">₩{priceFormatted}~</p>
          )}
          {(duration || priceMeta) && (
            <p className="type-caption text-[var(--text-muted)]">{[duration, priceMeta].filter(Boolean).join(" / ")}</p>
          )}
          {typeof fuelSurchargeIncluded === "boolean" && (
            <p className="type-caption flex items-center gap-1.5 text-[var(--text-muted)]">...</p>
          )}
        </div>
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {hashtags.map((tag) => (
              <span key={tag} className="type-caption text-[var(--text-secondary)]">#{tag}</span>
            ))}
          </div>
        )}
        <span className={cn("type-btn mt-auto inline-flex w-fit rounded-lg bg-[var(--primary)] px-4 py-2 text-white", CARD_TRANSITION, "group-hover:bg-[var(--primary-hover)] ...")}>
          {ctaLabel}
        </span>
      </div>
    </Link>
  );
}
```

### 2-2. ProductCardV2 (목록/검색/추천 실제 사용)

**File:** `src/components/products/ProductCardV2.tsx`

- Props: `title`, `price`, `duration`, `region`, `categories`, `tags`, `status`, `badges`, `thumbnailUrl`, `hrefDetail`, `onClickDetail`, `onClickConsult`, `priceMeta`, `metaInfo`, `analyticsSource`, `analyticsSection`, `productId`, `layout` (grid | list), `maxTags`.
- 레이아웃: 왼쪽 썸네일(칩 오버레이) + 오른쪽 본문(title, metaLine, price, tags, 자세히 보기/상담 문의).
- 래퍼: `Card variant="interactive"` + `CARD_TRANSITION`, hover 시 border/shadow.
- `hrefDetail` 있으면 `Link`로 감싸고, 없으면 `Card`에 `onClickDetail`/`onKeyDown`.

(전체 코드는 360줄 가량이므로 여기서는 구조만 요약. 상세는 소스 참고.)

---

## 3. 검색 결과 카드

- `SearchResultCard.tsx`, `ProductSearchCard.tsx` **없음**.
- 검색 결과 상품 카드는 **SearchResults.tsx**에서 **ProductCardV2** 또는 fallback 인라인으로 렌더.

**File:** `src/components/search/SearchResults.tsx`

```tsx
"use client";

import Link from "next/link";
import type { Product } from "@/types/product";
import ProductCardV2 from "@/components/products/ProductCardV2";
import { getProductBadges } from "@/lib/productCategory";
import { parseMetaTitleAsHashtags } from "@/lib/products/parseMetaTitleAsHashtags";
import type { ProductCardV2Status } from "@/components/products/ProductCardV2";
import { ENABLE_NEW_PRODUCT_UI } from "@/config/featureFlags";
import { cn } from "@/lib/cn";

const PRIORITY_BADGES = ["제철", "인기", "마감임박"];

function buildV2Badges(product: Product, themeBadges: string[]): { type: string; label: string; priority?: number; isActive?: boolean }[] {
  return themeBadges.map((label) => ({
    type: PRIORITY_BADGES.includes(label) ? "gold" : "muted",
    label,
    priority: PRIORITY_BADGES.includes(label) ? 5 : 0,
    isActive: true,
  }));
}

export type SearchResultsProps = { products: Product[] };

export default function SearchResults({ products }: SearchResultsProps) {
  if (products.length === 0) return null;

  if (!ENABLE_NEW_PRODUCT_UI) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            className="flex h-full flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] transition hover:shadow-[var(--shadow-soft-strong)]"
          >
            <div className="relative aspect-[16/10] w-full bg-[var(--surface-muted)]">
              <img src={product.image_url} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-1 flex-col p-4">
              <p className="font-semibold text-[var(--foreground)] line-clamp-2">{product.title}</p>
              {typeof product.price === "number" && (
                <p className="mt-2 font-semibold text-[var(--primary)]">
                  {new Intl.NumberFormat("ko-KR").format(product.price)}원~
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <ul
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
      )}
      aria-label="검색 결과 상품 목록"
    >
      {products.map((product) => {
        const badges = getProductBadges(product);
        const hashtags = parseMetaTitleAsHashtags(product.meta_title);
        const status: ProductCardV2Status = product.status ?? "AVAILABLE";
        return (
          <li key={product.id}>
            <ProductCardV2
              layout="grid"
              title={product.title}
              price={product.price}
              duration={product.duration}
              region={product.category}
              categories={[product.category]}
              tags={hashtags}
              status={status}
              badges={buildV2Badges(product, badges)}
              thumbnailUrl={product.image_url}
              priceMeta={product.price_meta ?? "1인 기준"}
              metaInfo={product.meta_info ?? ""}
              hrefDetail={`/products/${product.id}`}
              analyticsSource="product_list"
              analyticsSection="search"
              productId={product.id}
            />
          </li>
        );
      })}
    </ul>
  );
}
```

---

## 4. 상품 추천 카드 (상세페이지 / 기타)

- 상품 상세 페이지(`src/app/products/[id]/page.tsx`)에는 **연관 상품 카드 섹션이 없음**. 연관 가이드만 `GuideCard`로 노출.
- 검색 페이지 하단 “이런 상품도 있어요”는 **RelatedProductsSection**이며 내부에서 **ProductCardV2** 사용.

**File:** `src/components/search/RelatedProductsSection.tsx`

```tsx
"use client";

import type { Product } from "@/types/product";
import ProductCardV2 from "@/components/products/ProductCardV2";
import { getProductBadges } from "@/lib/productCategory";
import { parseMetaTitleAsHashtags } from "@/lib/products/parseMetaTitleAsHashtags";
import type { ProductCardV2Status } from "@/components/products/ProductCardV2";
import { ENABLE_NEW_PRODUCT_UI } from "@/config/featureFlags";
import { cn } from "@/lib/cn";

const PRIORITY_BADGES = ["제철", "인기", "마감임박"];

function buildV2Badges(product: Product, themeBadges: string[]): { type: string; label: string; priority?: number; isActive?: boolean }[] {
  return themeBadges.map((label) => ({
    type: PRIORITY_BADGES.includes(label) ? "gold" : "muted",
    label,
    priority: PRIORITY_BADGES.includes(label) ? 5 : 0,
    isActive: true,
  }));
}

export type RelatedProductsSectionProps = {
  title?: string;
  products: Product[];
};

export default function RelatedProductsSection({ title = "이런 상품도 있어요", products }: RelatedProductsSectionProps) {
  if (products.length === 0) return null;

  if (!ENABLE_NEW_PRODUCT_UI) {
    return (
      <section className="space-y-4">
        <h2 className="heading-display type-h3 text-[var(--foreground)]">{title}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <a
              key={product.id}
              href={`/products/${product.id}`}
              className="flex h-full flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] transition hover:shadow-[var(--shadow-soft-strong)]"
            >
              <div className="relative aspect-[16/10] w-full bg-[var(--surface-muted)]">
                <img src={product.image_url} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="font-semibold text-[var(--foreground)] line-clamp-2">{product.title}</p>
                {typeof product.price === "number" && (
                  <p className="mt-2 font-semibold text-[var(--primary)]">{new Intl.NumberFormat("ko-KR").format(product.price)}원~</p>
                )}
              </div>
            </a>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="related-products-heading" className="space-y-4">
      <h2 id="related-products-heading" className="heading-display type-h3 text-[var(--foreground)]">{title}</h2>
      <ul
        className={cn(
          "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        )}
        aria-label="추천 상품 목록"
      >
        {products.map((product) => {
          const badges = getProductBadges(product);
          const hashtags = parseMetaTitleAsHashtags(product.meta_title);
          const status: ProductCardV2Status = product.status ?? "AVAILABLE";
          return (
            <li key={product.id}>
              <ProductCardV2
                layout="grid"
                title={product.title}
                price={product.price}
                duration={product.duration}
                region={product.category}
                categories={[product.category]}
                tags={hashtags}
                status={status}
                badges={buildV2Badges(product, badges)}
                thumbnailUrl={product.image_url}
                priceMeta={product.price_meta ?? "1인 기준"}
                metaInfo={product.meta_info ?? ""}
                hrefDetail={`/products/${product.id}`}
                analyticsSource="product_list"
                analyticsSection="search_related"
                productId={product.id}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

**참고:** 랜딩 페이지(destination/theme)의 추천 상품 카드는 별도 컴포넌트 **LandingProductCard** (`src/components/products/landing/ProductLandingPage.tsx` 내부)를 사용. 구조는 이미지 + 카테고리/제목/테마/가격이며, `Product` 타입이 아닌 `ProductLandingProductSummary` 기반.

---

## 5. 상품 목록 페이지 (카드 렌더링 부분만)

목록 페이지는 `ProductsPageContent` → **ProductCatalogSection**에서 카드를 그린다. 카드 렌더링만 발췌.

**File:** `src/app/products/page.tsx`  
(카드는 여기서 직접 렌더하지 않고 `ProductsPageContent`에 넘김.)

```tsx
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
/>
```

**File:** `src/components/ProductCatalogSection.tsx` — 상품 카드 렌더링 부분

```tsx
// displayGroups.map 내부, group.products.map
{group.products.map((product) => {
  const badges = getProductBadges(product);
  const hashtags = parseMetaTitleAsHashtags(product.meta_title);
  const tags = buildProductCardTags(product, badges);
  const status: ProductCardV2Status = product.status ?? "AVAILABLE";
  if (ENABLE_NEW_PRODUCT_UI) {
    return (
      <ProductCardV2
        key={product.id}
        layout="list"
        title={product.title}
        price={product.price}
        duration={product.duration}
        region={product.theme}
        categories={[product.category]}
        tags={hashtags}
        status={status}
        badges={buildV2Badges(product, badges)}
        thumbnailUrl={product.image_url}
        priceMeta={product.price_meta || "1인 기준"}
        metaInfo={product.meta_info ?? ""}
        hrefDetail={`/products/${product.id}`}
        onClickDetail={() => router.push(`/products/${product.id}`)}
        onClickConsult={() => handleProductConsult(product)}
        analyticsSource="product_list"
        analyticsSection="catalog"
        productId={product.id}
      />
    );
  }
  return (
    <Link key={product.id} href={`/products/${product.id}`} className="h-full overflow-hidden rounded-3xl bg-[var(--surface)] ...">
      <article className="flex h-full flex-col">
        <Image src={product.image_url} ... />
        <div className="flex flex-1 flex-col gap-3 p-5">
          {/* category pill, badges, h2, description, price, hashtags, 상세 보기 span */}
        </div>
      </article>
    </Link>
  );
})}
```

---

## 6. 검색 결과 페이지 (상품 카드 렌더링 부분)

**File:** `src/app/search/page.tsx` — 상품/추천 노출 부분

```tsx
{hasCondition && products.length > 0 && totalPages <= 1 && (
  <SearchResults products={products} />
)}
// ...
{hasCondition && recommendations.products.length > 0 && (
  <RelatedProductsSection
    title={totalCount > 0 ? "이런 상품도 있어요" : "추천 여행 상품"}
    products={recommendations.products}
  />
)}
```

검색 결과 1페이지일 때 `SearchResults`가 상품 그리드를, 페이지네이션 있을 때는 `SearchResultsContainer`가 내부에서 동일하게 상품 리스트를 불러와 렌더. 실제 카드 컴포넌트는 위 **3. SearchResults**와 **4. RelatedProductsSection**에서 사용하는 **ProductCardV2**이다.

---

## 7. 공용 카드 스타일

**File:** `src/lib/cardTokens.ts`

```ts
/**
 * 유저 페이지 공통 카드 시각 토큰.
 * 홈/목록/상세 카드·섹션에서 일관된 rounded, shadow, ring, hover, padding 사용.
 *
 * PR26: 홈 카드 디자인 시스템 통합.
 * 기준 = 지역별 카드 섹션(HomeTaxonomyGrid). 테마/추천상품 카드와 공통 규칙 적용.
 */

/** 카드 wrapper 기본: 배경·테두리·그림자·라운드 */
export const CARD_BASE =
  "rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]";

/** 홈 카드용 wrapper: 지역/테마/추천상품 통일. 모바일 rounded-xl, sm 이상 rounded-2xl */
export const CARD_BASE_HOME =
  "rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]";

/** 카드 hover 시 강조 (링크/버튼 카드용) */
export const CARD_HOVER =
  "hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-soft-strong)]";

/** 카드 전환 */
export const CARD_TRANSITION = "transition-all duration-200 ease-out";

/** 카드 내부 패딩 - 기본 */
export const CARD_PADDING = "p-4";

/** 홈 카드 본문 패딩: 지역 카드 기준. 모바일 px-3 pt-2 pb-3, sm 이상 p-4 */
export const CARD_PADDING_HOME = "px-3 pt-2 pb-3 sm:p-4";

/** 카드 내부 패딩 - 여유 */
export const CARD_PADDING_RELAXED = "p-5";

/** 카드 이미지 영역 공통 */
export const CARD_IMAGE_WRAPPER = "relative w-full overflow-hidden";

/** 홈 카드 이미지 비율: 지역/테마와 동일. 16:9(모바일), 4:3( md 이상) */
export const CARD_IMAGE_ASPECT_HOME = "aspect-[16/9] md:aspect-[4/3]";

/** 홈 카드 제목: font-card-title, text-sm, semibold, leading-tight */
export const CARD_TITLE_HOME =
  "font-card-title text-sm font-semibold leading-tight text-[var(--foreground)]";

/** 홈 카드 보조 텍스트(메타/설명 1줄) */
export const CARD_META_HOME =
  "mt-0.5 line-clamp-1 text-xs text-[var(--text-muted)] md:type-caption";

/** 홈 카드 배지/칩 스타일: 추천상품 등. 작은 pill, surface-muted, ring */
export const CARD_BADGE_HOME =
  "rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--text-muted)] ring-1 ring-[var(--border)]";

/** 그리드 갭 - 카드 간격 */
export const CARD_GRID_GAP = "gap-4";

/** 그리드 갭 - 여유 */
export const CARD_GRID_GAP_RELAXED = "gap-6";
```

---

## 8. 상품 타입 정의

**File:** `src/types/product.ts` — `Product` 타입만

```ts
export type Product = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  images_json?: string[];
  category: string;
  theme?: string;
  destination_id?: string | null;
  product_line_id?: string | null;
  campaigns?: string[] | null;
  campaigns_json?: string[] | null;
  tags?: string[] | null;
  price?: number;
  duration?: string;
  itinerary?: string;
  inclusions?: string;
  point_benefits?: string;
  point_tourism?: string;
  point_guide?: string;
  meeting_info?: string;
  travel_insurance?: string;
  included_items?: string;
  excluded_items?: string;
  detailed_schedule?: string;
  optional_tours?: string;
  min_departure_people?: string;
  terms_and_notes?: string;
  terms_template_type?: string;
  product_source_url?: string;
  departure_from_airport?: string;
  departure_from_date?: string;
  departure_from_time?: string;
  departure_to_airport?: string;
  departure_to_date?: string;
  departure_to_time?: string;
  departure_flight_name?: string;
  departure_baggage_limit?: string;
  arrival_from_airport?: string;
  arrival_from_date?: string;
  arrival_from_time?: string;
  arrival_to_airport?: string;
  arrival_to_date?: string;
  arrival_to_time?: string;
  arrival_flight_name?: string;
  arrival_baggage_limit?: string;
  meta_title?: string;
  meta_description?: string;
  is_active?: boolean;
  sort_order?: number;
  created_at?: string;
  status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  fuel_included?: boolean;
  price_meta?: string;
  meta_info?: string;
  one_liner?: string;
  overview_json?: ProductOverview | null;
  itinerary_media_json?: Record<string, string> | null;
  itinerary_days_json?: ItineraryStructuredDay[] | null;
  itinerary_v2_json?: ItineraryV2 | null;
  theme_chart_json?: { items: Array<{ label: string; percent: number }> } | null;
  overview_accommodation?: string;
  overview_region?: string;
  overview_duration?: string;
  trust?: ProductTrust;
  options?: ProductOptions;
};
```

---

## 9. normalizeProduct

**File:** `src/lib/products.ts` — `normalizeProduct` 함수 전체

```ts
export function normalizeProduct(row: Record<string, unknown>): Product {
  const rawPrice = row.price;
  const price = typeof rawPrice === "number" ? rawPrice : undefined;
  const sortOrder = typeof row.sort_order === "number" ? row.sort_order : undefined;
  const images = normalizeImageList(
    Array.isArray(row.images_json)
      ? (row.images_json as Array<string | null | undefined>)
      : null,
  );
  const primaryImage = images[0] ?? String(row.image_url ?? row.image ?? FALLBACK_IMAGE);

  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? row.name ?? "상품명 미정"),
    description: String(row.description ?? row.content ?? "상세 설명이 준비 중입니다."),
    image_url: primaryImage,
    images_json: images.length > 0 ? images : undefined,
    category: String(row.category ?? row.type ?? "여행상품"),
    theme: typeof row.theme === "string" ? row.theme : undefined,
    destination_id: safeUuidOrNull(row.destination_id),
    product_line_id: safeUuidOrNull(row.product_line_id),
    campaigns: normalizeStringArray(row.campaigns),
    campaigns_json: normalizeStringArray(row.campaigns_json ?? row.campaigns),
    tags: normalizeStringArray(row.tags_json ?? row.tags),
    price,
    duration:
      typeof row.duration === "string"
        ? row.duration
        : typeof row.duration_days === "number"
          ? `${row.duration_days}일`
          : undefined,
    itinerary: typeof row.itinerary === "string" ? row.itinerary : undefined,
    inclusions: typeof row.inclusions === "string" ? row.inclusions : undefined,
    point_benefits: typeof row.point_benefits === "string" ? row.point_benefits : undefined,
    point_tourism: typeof row.point_tourism === "string" ? row.point_tourism : undefined,
    point_guide: typeof row.point_guide === "string" ? row.point_guide : undefined,
    meeting_info: typeof row.meeting_info === "string" ? row.meeting_info : undefined,
    travel_insurance: typeof row.travel_insurance === "string" ? row.travel_insurance : undefined,
    included_items: typeof row.included_items === "string" ? row.included_items : undefined,
    excluded_items: typeof row.excluded_items === "string" ? row.excluded_items : undefined,
    detailed_schedule: typeof row.detailed_schedule === "string" ? row.detailed_schedule : undefined,
    optional_tours: typeof row.optional_tours === "string" ? row.optional_tours : undefined,
    min_departure_people: typeof row.min_departure_people === "string" ? row.min_departure_people : undefined,
    terms_and_notes: typeof row.terms_and_notes === "string" ? row.terms_and_notes : undefined,
    terms_template_type: typeof row.terms_template_type === "string" ? row.terms_template_type : undefined,
    departure_from_airport: typeof row.departure_from_airport === "string" ? row.departure_from_airport : undefined,
    departure_from_date: typeof row.departure_from_date === "string" ? row.departure_from_date : undefined,
    departure_from_time: typeof row.departure_from_time === "string" ? row.departure_from_time : undefined,
    departure_to_airport: typeof row.departure_to_airport === "string" ? row.departure_to_airport : undefined,
    departure_to_date: typeof row.departure_to_date === "string" ? row.departure_to_date : undefined,
    departure_to_time: typeof row.departure_to_time === "string" ? row.departure_to_time : undefined,
    departure_flight_name: typeof row.departure_flight_name === "string" ? row.departure_flight_name : undefined,
    departure_baggage_limit: typeof row.departure_baggage_limit === "string" ? row.departure_baggage_limit : undefined,
    arrival_from_airport: typeof row.arrival_from_airport === "string" ? row.arrival_from_airport : undefined,
    arrival_from_date: typeof row.arrival_from_date === "string" ? row.arrival_from_date : undefined,
    arrival_from_time: typeof row.arrival_from_time === "string" ? row.arrival_from_time : undefined,
    arrival_to_airport: typeof row.arrival_to_airport === "string" ? row.arrival_to_airport : undefined,
    arrival_to_date: typeof row.arrival_to_date === "string" ? row.arrival_to_date : undefined,
    arrival_to_time: typeof row.arrival_to_time === "string" ? row.arrival_to_time : undefined,
    arrival_flight_name: typeof row.arrival_flight_name === "string" ? row.arrival_flight_name : undefined,
    arrival_baggage_limit: typeof row.arrival_baggage_limit === "string" ? row.arrival_baggage_limit : undefined,
    meta_title: typeof row.meta_title === "string" ? row.meta_title : undefined,
    meta_description: typeof row.meta_description === "string" ? row.meta_description : undefined,
    is_active: typeof row.is_active === "boolean" ? row.is_active : undefined,
    sort_order: sortOrder,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    status:
      row.status === "AVAILABLE" || row.status === "LIMITED" || row.status === "SOLD_OUT" || row.status === "CONSULT_REQUIRED"
        ? row.status
        : undefined,
    fuel_included: row.fuel_included === true ? true : row.fuel_included === false ? false : undefined,
    price_meta: typeof row.price_meta === "string" && row.price_meta.trim() !== "" ? row.price_meta.trim() : undefined,
    meta_info: typeof row.meta_info === "string" && row.meta_info.trim() !== "" ? row.meta_info.trim() : undefined,
    overview_accommodation: typeof row.overview_accommodation === "string" && row.overview_accommodation.trim() !== "" ? row.overview_accommodation.trim() : undefined,
    overview_region: typeof row.overview_region === "string" && row.overview_region.trim() !== "" ? row.overview_region.trim() : undefined,
    overview_duration: typeof row.overview_duration === "string" && row.overview_duration.trim() !== "" ? row.overview_duration.trim() : undefined,
    one_liner: typeof row.one_liner === "string" && row.one_liner.trim() !== "" ? row.one_liner.trim() : undefined,
    overview_json: normalizeOverview(row.overview_json),
    itinerary_media_json: normalizeItineraryMedia(row.itinerary_media_json),
    itinerary_days_json: normalizeItineraryDays(row.itinerary_days_json),
    itinerary_v2_json: normalizeItineraryV2(row.itinerary_v2_json),
    theme_chart_json: normalizeThemeChartJson(row.theme_chart_json),
    trust: normalizeTrust(row.trust),
    options: normalizeOptions(row.options, typeof row.price === "number" ? row.price : undefined),
  };
}
```

---

## 요약 표 (구조 비교용)

| 구분 | 컴포넌트 | 입력 | 레이아웃 | 스타일 토큰 | 비고 |
|------|----------|------|----------|-------------|------|
| 홈 추천 | **CuratedProductCard** | `Product` | 이미지 위 + 아래(배지/제목/메타/가격) | CARD_BASE_HOME, CARD_*_HOME | cardTokens 사용 |
| 목록(레거시) | **ProductCard** | props (href, imageUrl, tags, title, …) | 이미지 위 + 아래(Tag/제목/설명/가격/CTA) | CARD_BASE, CARD_PADDING_RELAXED 등 | Tag, CTA 버튼 |
| 목록/검색/추천 | **ProductCardV2** | ProductCardV2Props (title, price, thumbnailUrl, status, badges, …) | 좌(썸네일+칩) / 우(제목, 메타, 가격, 태그, CTA/상담) | Card, CARD_TRANSITION | grid/list, 상담 버튼 |
| 검색 결과 | **SearchResults** | products | ProductCardV2 또는 인라인 Link (fallback) | — | ENABLE_NEW_PRODUCT_UI 분기 |
| 검색 추천 | **RelatedProductsSection** | products, title | ProductCardV2 그리드 | — | search_related |
| 목록 섹션 | **ProductCatalogSection** | products, 필터/탭 | ProductCardV2(list) 또는 인라인 article Link | — | ENABLE_NEW_PRODUCT_UI 분기 |
| 랜딩 | **LandingProductCard** (ProductLandingPage 내부) | ProductLandingProductSummary | 이미지 + 본문(카테고리/제목/테마/가격) | 인라인 rounded-2xl 등 | Product 타입 아님 |

이 발췌를 바탕으로 상품 카드 구조 차이 여부, 카드 UI 통일 가능 여부, PR30 설계를 진행하면 됩니다.
