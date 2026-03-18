# 상품 필터·목록 엔진 발췌 Part 2 (4~8)

Part 1(`products-filter-list-engine-excerpt.md`)에서 이어집니다.  
아래는 **생략 없이 전체 복사 가능**한 파일 목록과 경로입니다. 코드가 긴 파일은 **저장소 경로**만 적고, 실제 전체 내용은 해당 경로의 파일을 열어 복사하세요.

---

## 3) 필터 UI — 나머지 (전체 복사용 경로)

| 용도 | 파일 경로 |
|------|-----------|
| 좌측 필터 패널 (지역·테마·상품군·정렬, 트리, sticky) | `src/components/products/ProductFilterSidebar.tsx` |
| 선택 필터 칩 | `src/components/products/ProductFilterChips.tsx` |
| 모바일 필터 드로어 | `src/components/products/MobileProductFilterDrawer.tsx` |
| 모바일 정렬 시트 | `src/components/products/MobileProductSortSheet.tsx` |

---

## 4) 상품 목록 렌더링

| 용도 | 파일 경로 |
|------|-----------|
| 상품 리스트/그리드 + 카테고리·테마 탭 + 요약 + 빈 결과 | `src/components/ProductCatalogSection.tsx` |
| 데스크톱 목록 카드 | `src/components/products/ProductListCard.tsx` |
| 모바일 목록 카드 | `src/components/products/ProductListCardMobile.tsx` |
| 그리드 래퍼 (추천/랜딩용) | `src/components/products/ProductCardGridSection.tsx` |

**요약:** 페이지네이션 컴포넌트는 없음. `ProductCatalogSection`이 필터 결과 전체를 테마별 그룹으로 표시하고, 빈 결과 시 "선택한 조건에 맞는 상품이 없습니다" + "전체 상품 보기" / "필터 초기화" CTA 노출.

---

## 5) 데이터 조회/가공

| 용도 | 파일 경로 |
|------|-----------|
| 필터 상태 타입, searchParams 파싱, URL 병합, 필터 적용 | `src/lib/productFilters.ts` |
| 랜딩 파라미(destination/city/theme) → 초기 필터 해석 | `src/lib/productFiltersLanding.ts` |
| 랜딩 데이터(hero/추천/관련 taxonomy) | `src/lib/productLanding.ts` |
| taxonomy 옵션, 허브 목록, 트리 빌드, slug→name | `src/lib/productTaxonomies.ts` |
| 상품 목록 조회 (getProducts) | `src/lib/products.ts` |
| Product → 카드 props | `src/lib/productCardProps.ts` |
| 카테고리/테마 탭 매칭, 그룹핑 | `src/lib/productCategory.ts` |
| Product 타입 | `src/types/product.ts` |
| RegionTreeNode, ProductTaxonomy 등 | `src/types/productTaxonomy.ts` |
| 랜딩 데이터 타입 | `src/types/productLanding.ts` |

---

## 6) URL / 상태 동기화

- **searchParams 파싱:** `parseProductFiltersFromSearchParams` in `src/lib/productFilters.ts`
- **필터 변경 시 URL 갱신:** `mergeFiltersIntoSearchParams` in `src/lib/productFilters.ts`, 호출처는 `ProductsPageContent.tsx` 의 `handleFilterChange` → `router.push(qs ? \`/products?${qs}\` : "/products")`
- **slug → 초기 필터값:** `resolveLandingParams` in `src/lib/productFiltersLanding.ts` (destination/city/theme 쿼리 → region/theme name). `/products/region/[slug]`, `/products/theme/[slug]` 는 랜딩 데이터 없으면 `redirect(\`/products?region=...\`)` / `redirect(\`/products?theme=...\`)` 로 보내서, 결국 `/products` + query에서 `resolveLandingParams` 로 초기 필터가 세팅됨.
- **랜딩 전용 링크 생성:** `buildProductsFilterHref` in `src/lib/productFilters.ts`, `getDestinationLandingHref` / `getThemeLandingHref` in `src/lib/hubLandingLinks.ts`

---

## 7) 레이아웃 / 조합

| 용도 | 파일 경로 |
|------|-----------|
| 페이지 폭·패딩 컨테이너 | `src/components/layout/PageContainer.tsx` |
| 상품 상단 히어로 (패키지/골프) | `src/components/ProductsHero.tsx` |
| 필터+목록 2단 레이아웃 | `src/components/products/ProductsPageContent.tsx` (flex gap-8, 좌측 Sidebar + 우측 ProductCatalogSection) |
| 랜딩: 히어로/바로가기/추천상품/관련 taxonomy/하단 CTA | `src/components/products/landing/ProductLandingPage.tsx` |

---

## 8) 스타일

- 별도 CSS 모듈/스타일 파일 없음. 모두 **Tailwind `className`**.
- 필터 패널: `ProductFilterSidebar.tsx` — `w-72 shrink-0 lg:block`, `sticky top-24`, `rounded-2xl border border-[var(--border)]` 등.
- 브레이크포인트: `lg:block`(사이드바), `lg:hidden`(모바일 필터/정렬 버튼·드로어·시트).

---

## Part 1 + Part 2 로 PR 검토 시 확인 포인트

1. **공용화:** `ProductsPageContent` + `ProductFilterSidebar` + `ProductFilterChips` + `MobileProductFilterDrawer` + `MobileProductSortSheet` + `ProductCatalogSection` + `productFilters` / `productFiltersLanding` / `applyProductFilters` 를 그대로 쓰면, 랜딩(`/products/region/[slug]`, `/products/theme/[slug]`)에서도 “같은 필터·목록 엔진”을 쓸 수 있음.
2. **기본 필터값만 다르게:** 랜딩 페이지에서 `initialFiltersFromServer` 에 `region` 또는 `theme` 만 세팅해 넘기면 됨. 현재는 랜딩이 “랜딩 UI만” 보여주고, “전체 상품 보기”는 `hero.primaryCtaHref` → `/products?region=...` 또는 `/products?theme=...` 로 이동해 `/products` 페이지가 `hasLandingParams` + `resolveLandingParams` 로 초기 필터를 채움. 동일 엔진을 랜딩 하단에 붙이려면, 랜딩 페이지에서 `ProductsPageContent` 를 렌더할 때 `initialFiltersFromServer` 에 해당 slug→name 해석 결과만 넣어 주면 됨.
3. **수정 범위 최소화:**  
   - 랜딩 페이지 컴포넌트에서 “추천 상품” 아래에 `ProductsPageContent` 삽입.  
   - 서버에서 `getProducts()`, taxonomy, `resolveLandingParams`(또는 slug→region/theme name) 호출해 `initialFiltersFromServer` 생성 후 전달.  
   - URL은 `/products/region/[slug]` 또는 `/products/theme/[slug]` 유지하고, 필터 변경 시 `router.push(\`/products/region/${slug}?${qs}\`)` 형태로 확장하면 됨(또는 기존처럼 `/products?region=...` 로 보내도 됨).
4. **PR 분리:**  
   - 1) `ProductsPageContent` 등 필터·목록 엔진을 “basePath” 또는 “baseUrl” prop으로 받아서 링크를 `/products` 대신 `/products/region/[slug]` 등으로 만들 수 있게 리팩터.  
   - 2) 랜딩 페이지에 “필터+목록” 블록 추가 시 `initialFiltersFromServer` 만 slug 기반으로 세팅.  
   - 3) (선택) `/products/region/page.tsx`, `/products/theme/page.tsx` 인덱스 페이지 추가 시 동일 엔진 재사용.

---

## 전체 복사 가능 코드 블록 (핵심 lib/타입)

아래는 필터·목록 엔진에서 사용하는 **lib/타입** 파일 전체입니다. 나머지 긴 파일(ProductFilterSidebar, ProductCatalogSection, productTaxonomies.ts, products.ts, ProductLandingPage, ProductListCard 등)은 위 표의 경로에서 열어 복사하세요.

### 파일 경로: `src/lib/productFilters.ts`

(전체 226줄 — 저장소 `src/lib/productFilters.ts` 에서 직접 복사하세요. 내용: PRODUCT_FILTER_KEYS, ProductSortId, ProductFiltersState, parseProductFiltersFromSearchParams, buildProductsSearchParams, buildProductsFilterHref, mergeFiltersIntoSearchParams, SORT_OPTIONS, applyProductFilters.)

### 파일 경로: `src/lib/productFiltersLanding.ts`

(전체 96줄 — 저장소 `src/lib/productFiltersLanding.ts` 에서 직접 복사하세요. 내용: ResolvedLandingFilters, resolveLandingParams, hasLandingParams.)

### 파일 경로: `src/lib/productCardProps.ts`

(전체 65줄 — 저장소 `src/lib/productCardProps.ts` 에서 직접 복사하세요.)

### 파일 경로: `src/lib/productCategory.ts`

(전체 59줄 — 저장소 `src/lib/productCategory.ts` 에서 직접 복사하세요.)

### 파일 경로: `src/components/layout/PageContainer.tsx`

(전체 42줄 — 저장소 `src/components/layout/PageContainer.tsx` 에서 직접 복사하세요.)

### 파일 경로: `src/components/products/ProductCardGridSection.tsx`

(전체 48줄 — 저장소 `src/components/products/ProductCardGridSection.tsx` 에서 직접 복사하세요.)

---

전체 코드가 필요하면 위 **파일 경로**에 해당하는 파일을 에디터에서 열어 그대로 복사하면 됩니다.
