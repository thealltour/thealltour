# 상품 카드 구조 발췌 (CTR 최적화 사전 정리)

발췌 시점 기준 저장소 경로. **전체 JSX는 파일이 길어 핵심 타입·분기·호출부 위주**로 정리했습니다. 상세 구현은 각 파일 원문을 참고하세요.

---

## 1. 관련 파일 목록

| 구분 | 경로 |
|------|------|
| 공통 그리드 카드 | `src/components/products/ProductCard.tsx` |
| 홈 큐레이션 전용 | `src/components/products/HomeProductCard.tsx` |
| 목록(데스크톱) | `src/components/products/ProductListCard.tsx` |
| 목록(모바일) | `src/components/products/ProductListCardMobile.tsx` |
| 그리드 래퍼 | `src/components/products/ProductCardGridSection.tsx` |
| Product → 카드 props | `src/lib/productCardProps.ts` |
| 카탈로그(필터·그룹) | `src/components/ProductCatalogSection.tsx` |
| 홈 추천 블록 | `src/components/home/CuratedSectionScrollBlock.tsx`, `CuratedBlock.tsx` |
| 검색 결과 | `src/components/search/SearchResults.tsx` |
| 상세 연관 | `src/components/products/RelatedProductsSection.tsx` |
| 랜딩 추천 그리드 | `src/components/products/landing/ProductLandingPage.tsx` |
| 상품 목록 페이지 조립 | `src/components/products/ProductsPageContent.tsx` |
| 타입 | `src/types/product.ts` (`Product`, `ProductTrust`) |
| 클릭 계측 | `src/lib/analytics/trackProductClick.ts` |
| 홈 taxonomy (상품 카드 아님) | `src/components/home/HomeTaxonomyGrid.tsx` |

---

## 2. 각 파일별 핵심 코드 발췌

### 2.1 `ProductCard.tsx` — props 타입

```ts
export type ProductCardLayout = "grid" | "list" | "related";

export type ProductCardProps = {
  title?: string;
  price?: number | string;
  duration?: string;
  region?: string;
  categories?: string[];
  tags?: string[];
  status?: ProductCardStatus;
  badges?: ProductCardBadge[];
  thumbnailUrl?: string;
  hrefDetail?: string;
  onClickDetail?: () => void;
  onClickConsult?: () => void;
  priceMeta?: string;
  metaInfo?: string;
  analyticsSource?: "product_list" | "landing" | "home_curated";
  analyticsSection?: string;
  productId?: string;
  layout?: ProductCardLayout;
  maxTags?: number;
  overviewStay?: string;
  overviewRegion?: string;
  overviewDuration?: string;
};
```

### 2.2 `ProductCard.tsx` — 렌더 요소·분기 요약

- **`layout === "related"`**: 세로 카드 — `aspect-[4/3]` 썸네일 상단, 배지 최대 2개, 기간 pill, 제목 `line-clamp-2`, 가격 `₩…~`, `loading="lazy"`, `unoptimized` on related 이미지.
- **그 외 (`grid` / `list` 동일 JSX)**: 좌측 썸네일(가로 비율) + 우측 본문 — 상단 칩(상태·카테고리/지역·뱃지 1개까지), 제목 `line-clamp-1`, 메타 `duration · metaInfo`, 가격, 해시태그(`maxTags`), “자세히 보기” 화살표, 선택적 상담 버튼.
- **썸네일**: `next/image` `fill`, `object-cover`, `group-hover:scale-[1.03]`, list/grid별 `sizes` 문자열 상이.
- **링크**: `hrefDetail` 있으면 전체 `Link` + `Card variant="interactive"`; 클릭 시 `trackProductCardClick` (아래 6절).

### 2.3 `HomeProductCard.tsx` — props & 요소

```ts
export type HomeProductCardProps = {
  product: Product;
  href?: string;
  className?: string;
  analyticsSection?: string;
};
```

- **썸네일**: `aspect-[3/2]` 모바일, `sm:aspect-[4/3]`; `sizes="(max-width: 640px) 42vw, 360px"`; `group-hover:scale-[1.02]`.
- **본문**: 지역 라벨(`overview_region` → `category` → `theme`), 제목 `line-clamp-2`, **별점+리뷰수**(`product.trust`), one_liner/meta/duration 서브메타, 가격, 푸터 배지(혜택/베스트).
- **배지**: 이미지 좌상단 1개(마감/마감임박/프로모션/인기).
- **전체 `Link`** + `trackProductCardClick` `source: "home_curated"`.

### 2.4 `productCardProps.ts` — view model 매핑

```ts
export function productToProductCardProps(
  product: Product,
  overrides?: ProductToProductCardOverrides,
): Omit<ProductCardProps, "onClickDetail" | "onClickConsult"> & ProductToProductCardOverrides {
  const isRelatedSection = overrides?.analyticsSection === "related_products";
  // ...
  return {
    title: product.title,
    price: product.price,
    duration: product.duration,
    region: product.theme,
    categories: [product.category].filter(Boolean),
    tags: parseMetaTitleAsHashtags(product.meta_title),
    status,
    badges: isRelatedSection ? relatedBadges : baseBadges,
    thumbnailUrl: getPrimaryImageUrl(product),
    priceMeta: product.price_meta ?? "1인 기준",
    metaInfo: product.meta_info ?? "",
    overviewStay: product.overview_accommodation?.trim() || product.meta_info?.trim() || "",
    overviewRegion: product.overview_region?.trim() || product.theme?.trim() || product.category?.trim() || "",
    overviewDuration: product.overview_duration?.trim() || product.duration?.trim() || "",
    hrefDetail: `/products/${product.id}`,
    productId: product.id,
    layout: "grid",
    ...overrides,
    ...(isRelatedSection ? { layout: "related" as const, badges: relatedBadges } : {}),
  };
}
```

- **`analyticsSection === "related_products"`** 이면 자동으로 **`layout: "related"`** + 인기/추천 뱃지 병합.

### 2.5 `ProductCardGridSection.tsx` — 모바일/데스크톱

```tsx
// 요약: 모바일 flex 가로 스크롤, sm 이상 grid
// homeCuratedMobileCompact: gap-2.5, min-w-[47%] max-w-[200px]
// 기본: gap-3, min-w-[78%] max-w-[320px]
// 데스크톱: sm:grid-cols-2, lg:grid-cols-3 | desktopGridCols===2 이면 lg:grid-cols-2
```

### 2.6 `ProductCatalogSection.tsx` — 카드 분기

```tsx
// cardLayout === "related" (랜딩 카탈로그)
<ProductCardGridSection desktopGridCols={2}>
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

// cardLayout === "list" (기본 /products 목록)
<div className="hidden md:block">
  <ProductListCard {...cardProps} />
</div>
<div className="md:hidden">
  <ProductListCardMobile {...cardProps} />
</div>
// cardProps = productToProductCardProps(product, {
//   analyticsSource: "product_list",
//   analyticsSection: "catalog",
//   onClickDetail: () => router.push(...),
//   onClickConsult: () => handleProductConsult(product),
// });
```

### 2.7 홈 `page.tsx` — 상품 카드 직접 호출 없음

- `CuratedProductsSection` → `CuratedSectionScrollBlock` → **`HomeProductCard`** + `ProductCardGridSection` `homeCuratedMobileCompact`.
- (참고) `DestinationSection` / `ThemeSection`은 **`HomeTaxonomyGrid`** — 상품 카드가 아님.

### 2.8 `CuratedSectionScrollBlock.tsx`

```tsx
<ProductCardGridSection homeCuratedMobileCompact>
  {section.products.map((product) => (
    <HomeProductCard
      key={product.id}
      product={product}
      analyticsSection={section.title ?? undefined}
    />
  ))}
</ProductCardGridSection>
```

### 2.9 `CuratedBlock.tsx` (홈 메인에서 미사용 가능성 있음 — 구조 참고)

```tsx
<ProductCardGridSection>
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
```

### 2.10 `SearchResults.tsx`

```tsx
<ProductCardGridSection>
  {products.map((product) => (
    <ProductCard
      key={product.id}
      {...productToProductCardProps(product, {
        layout: "grid",
        analyticsSource: "product_list",
        analyticsSection: "search",
      })}
    />
  ))}
</ProductCardGridSection>
```

### 2.11 `RelatedProductsSection.tsx`

- `productToProductCardProps(..., { analyticsSection: "related_products" })` → 내부적으로 **`layout: "related"`** 강제.

### 2.12 `ProductLandingPage.tsx` — 추천 상품 (Product 타입 매핑 아님)

```tsx
<ProductCardGridSection desktopGridCols={2}>
  {uniqueRecommendedProducts.map((item) => (
    <ProductCard
      key={item.id}
      layout="grid"
      title={item.title}
      price={item.price ?? undefined}
      region={item.themes?.join(", ")}
      categories={item.categories ?? []}
      status="AVAILABLE"
      thumbnailUrl={item.imageUrl ?? ""}
      hrefDetail={item.href}
      analyticsSource="landing"
      analyticsSection={`${data.type}_${data.taxonomySlug ?? data.slug ?? ""}`}
      productId={item.id}
    />
  ))}
</ProductCardGridSection>
```

### 2.13 `Product` 타입 — 카드와 연관된 필드 (발췌)

```ts
export type ProductTrust = {
  recentConsultCount?: number;
  recentDays?: number;
  totalInquiries?: number;
  ratingAvg?: number;
  reviewCount?: number;
};

export type Product = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  images_json?: string[];
  category: string;
  theme?: string;
  // ... taxonomy, campaigns, tags, highlights ...
  price?: number;
  duration?: string;
  meta_title?: string;
  is_recommend?: boolean;
  is_popular?: boolean;
  status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  price_meta?: string;
  meta_info?: string;
  one_liner?: string;
  overview_accommodation?: string;
  overview_region?: string;
  overview_duration?: string;
  trust?: ProductTrust;
  // options, overview_json, itinerary_* 등 — ProductCard 직접 미사용 다수
};
```

### 2.14 `trackProductCardClick` — payload

```ts
export type ProductCardClickSource = "home_curated" | "landing" | "product_list";

export type TrackProductCardClickParams = {
  productId: string;
  productTitle: string;
  href: string;
  source: ProductCardClickSource;
  section?: string | null;
  landingType?: "region" | "theme" | null;
  taxonomySlug?: string | null;
  pagePath?: string | null;
};

// 이벤트: ANALYTICS_EVENTS.product_card_click
// source 매핑: home_curated → home_curated_section, product_list → products_catalog,
//   landing + theme → landing_theme, 그 외 landing → landing_region
```

- **`ProductCard` / `ProductListCard*`의 `onClick` 핸들러**는 `landingType`·`taxonomySlug`를 넘기지 않음 → 랜딩 카드 클릭은 대부분 **`landing_region` 소스로 집계**될 수 있음(개선 여지).

---

## 3. 현재 구조 요약

### 3.1 카드 본체 컴포넌트

| 컴포넌트 | 용도 |
|----------|------|
| **ProductCard** | 그리드(홈 큐레이터블록·검색·가이드·연관), `related` 레이아웃, 랜딩 추천 그리드 |
| **HomeProductCard** | **홈 `CuratedSectionScrollBlock`만** — 세로형, 별점/리뷰, 클룩형 밀도 |
| **ProductListCard** | `/products` 목록 **데스크톱(md+)** — 가로 split + 상담 CTA |
| **ProductListCardMobile** | `/products` 목록 **모바일** — 별도 레이아웃, 배지/태그 상한 다름 |

### 3.2 홈 / 리스트 / 랜딩 호출 구조

- **홈 추천 상품**: `HomeProductCard` + `homeCuratedMobileCompact` 그리드만 **Product와 다름**.
- **홈 지역·테마**: taxonomy 카드(`HomeTaxonomyGrid`) — CTR 작업 시 범위에서 제외할지 명시 필요.
- **`/products` + URL 필터**: `ProductCatalogSection` → list 레이아웃 시 **ListCard 이원화**.
- **랜딩 `/products/region|theme/[slug]`**: `ProductLandingPage`는 추천 상품을 **raw props `ProductCard`**; 카탈로그 구간은 부모가 `ProductsPageContent`에 `cardLayout` 전달 시 `related` 그리드 가능.
- **검색**: `ProductCard` + `product_list` / `section: search`.

### 3.3 variant / layout 분기

- **`ProductCard.layout`**: `"grid"` | `"list"`(실제로 grid/list 동일 블록 사용) | `"related"`(별도 JSX).
- **`ProductCardGridSection`**: `desktopGridCols` 2|3, `homeCuratedMobileCompact`.
- **`ProductCatalogSection.cardLayout`**: `"list"` | `"related"`.
- **목록**: 반응형으로 **컴포넌트 자체 분리**(ProductListCard vs Mobile).

### 3.4 클릭 추적 여부

- **있음**: `ProductCard`, `HomeProductCard`, `ProductListCard`, `ProductListCardMobile` — `product_card_click` + `section` 문자열.
- **소스 구분**: `home_curated` | `product_list` | `landing` (랜딩 세부 taxonomy는 파라미터 미전달 시 한계).

---

## 4. CTR 최적화 시 “한 군데 수정”으로 해결 가능한 범위

- **`productToProductCardProps`**: 뱃지/태그/메타/오버뷰 필드 매핑 통일 → **ProductCard + ListCard**(동일 props) 파이프라인에 한 번에 반영 가능.
- **`ProductCard` 단일 컴포넌트**: `grid`/`related` UI, 칩 우선순위, 썸네일 hover, 제목 clamp — **검색·가이드·연관·(그리드형) 홈**에 동시 영향.
- **`ProductCardGridSection`**: 모바일 카드 폭·gap — **같은 래퍼 쓰는 모든 그리드**에 영향.
- **계측**: `trackProductCardClick` / payload 확장 — 한 파일에서 이벤트 스키마 정비 가능.

---

## 5. 페이지별 분리 수정이 필요한 범위

- **`HomeProductCard`**: 홈 큐레이션만 사용 — **여기서만** 별점/푸터 배지/비율 3:2 등이 다름. 홈 CTR 실험 시 **공통 ProductCard와 별도 튜닝** 필요.
- **`ProductListCard` / `ProductListCardMobile`**: `/products` 전용 레이아웃·상담 버튼·반응형 스위치 — 그리드 카드와 **코드 중복**(칩/가격 로직 유사).
- **`ProductLandingPage`**: `productToProductCardProps` 미사용 — 필드·뱃지 정책이 **카탈로그와 어긋날 수 있음**; 추천 그리드 CTR은 **별도 props 정비** 필요.
- **랜딩 카탈로그 `cardLayout="related"`**: `ProductCard` `related` 분기 — 목록 list 카드와 **완전히 다른 UI**.

---

## 6. 데이터로 바로 쓸 수 있는 CTR 신호 (요약)

| 신호 | Product 필드 | ProductCard / HomeProductCard |
|------|----------------|-------------------------------|
| 상태/마감 | `status` | 둘 다 칩/배지로 일부 사용 |
| 인기/추천 | `is_popular`, `is_recommend` | 뱃지 매핑(`productCardProps`, Home 이미지 배지) |
| 테마 뱃지 | `getProductBadges` 등 | ProductCard 칩 |
| 가격/메타 | `price`, `price_meta`, `meta_info` | 공통 |
| 한 줄 소개 | `one_liner` | **Home만** 서브메타 |
| 별점/리뷰 | `trust.ratingAvg`, `trust.reviewCount` | **Home만** |
| 최근 상담 등 | `trust.recentConsultCount`, `totalInquiries` | **카드 미사용** → 추가 여지 |
| 하이라이트/태그 | `highlights`, `tags`, `meta_title`(해시) | ProductCard 태그는 `meta_title` 파싱 위주 |
| 옵션/특가 문구 | `options` 등 | 카드 미사용 |

---

## 7. 이미지 (썸네일) 요약

- **ProductCard grid/list**: 좌측 고정 폭 비율, `sizes` list vs grid 다름, grid 쪽은 `unoptimized` 없음(related만 `unoptimized`).
- **HomeProductCard**: 세로형 비율, `sizes` 42vw/360px.
- 공통: `normalizeProductImageUrl`, 플레이스홀더/스켈레톤(ProductCard), Home은 picsum fallback.

---

## 8. 모바일 전용 스타일 요약

- **그리드 섹션**: `ProductCardGridSection` — 기본 1줄 가로 스크롤 ~78% 폭; 홈 큐레이션 ~47% 폭.
- **목록 `/products`**: `md` 기준으로 **ListCard ↔ ListCardMobile 완전 교체**.
- **HomeProductCard**: `sm:`에서 타이포·패딩·이미지 비율 변경.

---

## 9. 결정용 체크 (사용자 질문에 대한 답)

| 질문 | 방향 |
|------|------|
| 홈 CTR을 공통 카드에서 처리할지 | **부분만**: 그리드형은 `ProductCard`/`productCardProps`; **홈 큐레이션은 `HomeProductCard` 별도**. |
| 홈 전용 분리 유지할지 | **이미 분리됨** — 실험은 HomeProductCard 또는 홈만 `ProductCard`로 통합하는 큰 PR 중 선택. |
| 우선 넣을 신호 | `trust`를 ProductCard 파이프라인에 올리면 검색·연관까지 확장; 홈은 이미 별점 있음. `recentConsultCount` 등은 데이터만으로 추가 가능. |
| 모바일/데스크톱 | 목록은 **이미 모바일 전용 컴포넌트**; 그리드는 **동일 ProductCard** + 래퍼 `min-w`만 다름. 홈 큐레이션 모바일만 먼저 손대려면 **`HomeProductCard` + `homeCuratedMobileCompact`**가 최소 단위. |

---

## 10. 문서 이력

- 초안: 상품 카드 구조·호출부·계측·데이터 CTR 사전 조사용 발췌.
- **feat(product-card) CTR:** `ProductCard`에 `trust`(별점·리뷰수, **리뷰 1건 이상일 때만**), `oneLiner`, 배지 최대 2개(`pickDisplayChips` + `displayChipSurfaceClass` in `productCardSignals.ts`). 그리드/리스트 본문 상단 배지+평점, 이미지 오버레이 칩 없음. 「자세히 보기」제거. 홈은 **`HomeProductCard` 독립 유지** — 동일 `pickDisplayChips`/뱃지 풀·시선 순서만 공통 규칙에 맞춤.

---

## 11. 갱신 후 요약 (feat product-card CTR)

| 항목 | 내용 |
|------|------|
| 공통 신호 | `productToProductCardProps`가 `oneLiner`, `ratingAvg`, `reviewCount` 전달; `인기`/`추천` 뱃지 후보 병합 |
| 별점 표시 | **평점 + 리뷰수>0** 일 때만 (ProductCard·HomeProductCard 동일) |
| 배지 | `pickDisplayChips`: 마감·마감임박·상담 후 안내 → 인기·추천 → 프로모션/기타, **최대 2개** |
| 레이아웃 | `grid` \| `list` \| `related` 만 (`stack` 제거). 홈 큐레이션은 `HomeProductCard` 세로형 |
| 홈 | `HomeProductCard` 전용 UI 유지 + `buildProductCardBadges`/`pickDisplayChips` 공유 |
