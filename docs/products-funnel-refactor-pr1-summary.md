# refactor(products-funnel) 1단계 — 무영향 리팩터링 결과 요약

> PR 목적: 중복 헬퍼·로더·pathname 판별·`ProductsPageContent` 호출부 정리. 기능·URL·필터·내비·배지·API/DB 변경 없음.

---

## 1. 변경 파일 목록

### 신규

- `src/lib/landing/buildDestinationFallbackImageMap.ts`
- `src/lib/products/loadProductsListingContext.ts`
- `src/lib/routing/getProductsFunnelPathKind.ts`
- `src/lib/landing/productSlugLandingMetadata.ts`
- `src/lib/landing/loadProductsSlugLandingPage.ts`
- `src/lib/products/productsPageContentConfig.ts`
- `src/lib/analytics/landingCtaPayload.ts`
- `src/lib/products/productCatalogKeyword.ts`

### 수정

- `src/app/products/page.tsx`
- `src/app/products/region/[slug]/page.tsx`
- `src/app/products/theme/[slug]/page.tsx`
- `src/app/destinations/page.tsx`
- `src/app/destinations/[slug]/page.tsx`
- `src/app/themes/[slug]/page.tsx`
- `src/components/navigation/breadcrumb-config.ts`
- `src/lib/navigation/productsNavigationPolicy.ts`
- `src/lib/navigation/getFallbackPath.ts`
- `src/components/products/ProductsPageContent.tsx`
- `src/components/products/landing/ProductLandingPage.tsx`
- `src/components/product-detail/ProductCatalogSection.tsx`

---

## 2. 파일별 변경 요약

| 영역 | 내용 |
|------|------|
| **fallback 이미지** | 지역 카드용 `buildDestinationFallbackImageMap`를 `lib/landing`으로 모으고 `destinations`·`destinations/[slug]` 등에서 import |
| **listing 로더** | `loadProductsListingContext("products_index" \| "product_landing")`, `loadProductsListingContextForDestinationDetail`, `loadProductsListingContextForThemeDetail`로 기존 `Promise.all` 구성·순서 유지 |
| **metadata 분리** | `loadProductRegionLandingMetadata` / `loadProductThemeLandingMetadata`로 `/products/region|theme/[slug]`의 `generateMetadata` 본문 이전 |
| **랜딩 본문** | `loadProductsRegionLandingPageBundle` / `loadProductsThemeLandingPageBundle`로 랜딩 분기 내부 데이터 조립 (redirect 조건은 page에 유지) |
| **pathname** | `getProductsFunnelPathKind` + `showProductsNavigationContext` / `getProductsNavPathKind` / `getFallbackPath`가 동일 분류를 사용 |
| **목록 설정** | `ProductsPageContentListingConfig` + `listing` prop으로 퍼널 옵션 전달 |
| **구조 준비(F)** | `buildLandingCtaPayload`, `productCatalogMatchesKeyword` / `normalizeProductCatalogSearchKeyword` 추출 (`use client` 경계 변경 없음) |

---

## 3. 공통화한 함수·타입 목록

- `buildDestinationFallbackImageMap`
- `loadProductsListingContext` (오버로드: `"products_index"` | `"product_landing"`)
- `finalizeListingContext` (모듈 내부 전용)
- `loadProductsListingContextForDestinationDetail` / `ProductsDestinationDetailListingBatch`
- `loadProductsListingContextForThemeDetail` / `ProductsThemeDetailListingBatch`
- `ProductsListingContext`, `ProductTaxonomyOptionsResult`
- `getProductsFunnelPathKind`, `ProductsFunnelPathKind`, `PRODUCTS_ROOT`, `PRODUCTS_REGION_HUB`, `PRODUCTS_THEME_HUB`
- `loadProductRegionLandingMetadata`, `loadProductThemeLandingMetadata`
- `loadProductsRegionLandingPageBundle`, `loadProductsThemeLandingPageBundle`, `ProductsRegionLandingPageBundle`, `ProductsThemeLandingPageBundle`
- `ProductsPageContentListingConfig`
- `buildLandingCtaPayload`
- `normalizeProductCatalogSearchKeyword`, `productCatalogMatchesKeyword`

---

## 4. 기존 동작과 동일함을 위해 유지한 부분

- `/products` 인덱스: `getProducts` → 4-way `Promise.all` 순서
- 랜딩 하단: 허브·상품 4-way 병렬 → `getProductTaxonomyOptions` 순차
- `/destinations/[slug]`, `/themes/[slug]`: 1차·2차 `Promise.all` 구성과 인자(가이드 id, 리뷰 4건 등) 동일
- `buildRegionTree` / `buildThemeTree` / `buildTaxonomyNameMap` 스프레드 순서·데이터 소스 동일
- 지역 fallback 맵: 기존 page 로컬 함수와 동일한 `find`·`map.set` 규칙
- SEO 객체 필드·문구·canonical/og/twitter 구성은 metadata 로더에 그대로 이전
- `ProductsPageContent` 내부 필터·정렬·`applyProductFilters` 로직 무변경 (`listing`에서 기존 props 기본값 병합)
- `ProductCatalogSection` 검색: 로컬 함수를 동일 로직으로 `productCatalogKeyword`로 이동
- 브레드크럼 라벨·href: `breadcrumb-config` 스위치는 동일, 허브 상수만 `getProductsFunnelPathKind` 모듈에서 import

---

## 5. 잠재 리스크 (3개 이하)

1. **배포 후 스모크**: 주요 URL·모바일 뒤로가기·랜딩 하단 필터 — pathname 분류를 한 곳으로 모은 만큼 `/products/…` 변형 URL은 수동 확인 권장.
2. **`products_other`**: 비표준 `/products/…` 하위 경로에 대한 fallback `/products` 유지용. 새 세그먼트 정책 시 `showProductsNavigationContext`와 함께 조정 필요.
3. **랜딩 번들**: region/theme가 동일 `loadProductsListingContext("product_landing")`를 공유. 한쪽만 최적화할 때 번들 분리가 2단계 후보.

---

## 6. 후속 PR(2단계) 연결 포인트

- `loadProductsListingContext`에 캐시·부분 재사용 또는 페이지네이션을 붙일 단일 진입점
- `getProductsFunnelPathKind`에 `/destinations` 등 허브 외 경로 정책 확장 여부
- `ProductLandingPage` / `ProductCatalogSection`의 서버·클라 경계 분리 시 `buildLandingCtaPayload`·`productCatalogKeyword`·`listing` config 활용
- `/themes/[slug]`의 `buildThemeFallbackImageMap`는 이번 범위 외 — 필요 시 `lib/landing`으로 동일 패턴 추출 가능

---

## 7. 검증

- `npm run build` 통과
- `npm run lint`는 저장소 전체 기존 이슈로 실패할 수 있음 (본 PR에서 `destinations` 미사용 `Product` import 등은 정리)

---

## 관련 문서

- 개선 여지 발췌(사전 분석): `docs/products-funnel-improvement-opportunities-excerpt.md`
