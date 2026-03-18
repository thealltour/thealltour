# PR2: 랜딩 하단 필터+상품목록 엔진 연결 — 산출물

## 목표

`/products/region/[slug]`, `/products/theme/[slug]` 랜딩 페이지의 기존 랜딩 UI는 유지하고,  
하단에 `/products`와 동일한 필터+상품 목록 엔진(`ProductsPageContent`)을 추가.

**구성 순서 유지:** 히어로 → 하위지역/하위테마 카드 → 추천 상품 → **필터+목록(추가)**.

---

## 1) 수정한 파일 목록

1. `src/app/products/region/[slug]/page.tsx`
2. `src/app/products/theme/[slug]/page.tsx`
3. `src/components/products/ProductsPageContent.tsx` (랜딩 첫 진입 시 초기 필터 적용을 위한 최소 로직 확장)

---

## 2) 각 파일별 핵심 변경 사항

### `src/app/products/region/[slug]/page.tsx`

- **import 추가:** `getHubThemes`, `getProductTaxonomyOptions`, `buildRegionTree`, `buildThemeTree`, `buildTaxonomyNameMap`, `getActiveProductLineTaxonomies`, `ProductsPageContent`, `PageContainer`.
- **데이터 준비:** 기존 `getHubDestinations()`, `getProducts()`에 `getHubThemes()`, `getActiveProductLineTaxonomies()` 병렬 추가. 이후 `getProductTaxonomyOptions(products)` 호출로 `categories`/`themes`/`productLines` 확보. `regionTree`, `themeTree`, `taxonomyNameMap` 생성.
- **초기 필터:** `initialFiltersFromServer = { region: landingData.taxonomyName, theme: null, product_line: null, q: null, sort: "", collection: null }`.
- **렌더:** 기존 `SiteHeader` + `ProductLandingPage` 유지. 그 아래 `PageContainer`로 감싼 `ProductsPageContent` 추가. `basePath={`/products/region/${trimmedSlug}`}` 전달.
- **레이아웃:** 하단 블록에 `min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)]`, `PageContainer`에 `py-8 sm:py-10 md:py-14` 적용.

### `src/app/products/theme/[slug]/page.tsx`

- **import 추가:** `getHubDestinations`, `getProductTaxonomyOptions`, `buildRegionTree`, `buildThemeTree`, `buildTaxonomyNameMap`, `getActiveProductLineTaxonomies`, `ProductsPageContent`, `PageContainer`.
- **데이터 준비:** 기존 `getHubThemes()`, `getProducts()`에 `getHubDestinations()`, `getActiveProductLineTaxonomies()` 병렬 추가. 이후 `getProductTaxonomyOptions(products)` 및 `regionTree`/`themeTree`/`taxonomyNameMap` 생성.
- **초기 필터:** `initialFiltersFromServer = { region: null, theme: landingData.taxonomyName, ... }`.
- **렌더:** `SiteHeader` + `ProductLandingPage` 유지. 그 아래 동일한 wrapper + `ProductsPageContent`, `basePath={`/products/theme/${trimmedSlug}`}`.
- **레이아웃:** 지역 랜딩과 동일한 wrapper·spacing.

### `src/components/products/ProductsPageContent.tsx`

- **초기 필터 사용 조건 확장:**  
  `destination`/`city`/`theme` 쿼리가 없을 때도, URL에 `region`/`theme`/`product_line`/`sort`/`q`가 없고 `initialFiltersFromServer`가 있으면 해당 값을 사용.  
  → 랜딩 첫 진입(`/products/region/tokyo`, `/products/theme/city-tour` 등)에서 쿼리 없이도 slug에 맞는 지역/테마가 선택된 상태로 시작.

---

## 3) 실제 diff 요약

### region/[slug]/page.tsx

- import: productTaxonomies에서 `getHubThemes`, `getProductTaxonomyOptions`, `buildRegionTree`, `buildThemeTree`, `buildTaxonomyNameMap`, `getActiveProductLineTaxonomies` 추가. `ProductsPageContent`, `PageContainer` 추가.
- `Promise.all`에 `getHubThemes()`, `getActiveProductLineTaxonomies()` 추가. 이어서 `getProductTaxonomyOptions(products)` 호출 및 `regionTree`/`themeTree`/`taxonomyNameMap` 구성.
- `initialFiltersFromServer` 객체 추가 (region: taxonomyName).
- return을 `<> SiteHeader, ProductLandingPage, 하단 div(PageContainer + ProductsPageContent) </>` 로 확장.

### theme/[slug]/page.tsx

- 동일한 방식으로 import·데이터 준비·`initialFiltersFromServer`(theme: taxonomyName)·하단 `ProductsPageContent` 추가.

### ProductsPageContent.tsx

- `filters` useMemo 내부: `hasLanding`으로 서버 초기 필터 사용 후,  
  `hasFilterInUrl`(region/theme/product_line/sort/q 유무)가 없고 `initialFiltersFromServer != null`이면 `initialFiltersFromServer` 반환하도록 분기 추가.

---

## 4) Merge 전 확인 (1·2)

### 1) ProductsPageContent — initialFiltersFromServer 분기가 `/products` 동작을 건드리지 않는지

**분기 순서 (현재 코드):**

1. `hasLanding`(URL에 `destination` / `city` / `theme` 있음) 이고 `initialFiltersFromServer != null` → **서버 초기값 사용** (기존 `/products?destination=...` 등 동작 유지).
2. 그 다음: URL에 `region` / `theme` / `product_line` / `sort` / `q` 중 하나라도 있으면 `hasFilterInUrl === true` → **서버 초기값 사용 안 함** → `parseProductFiltersFromSearchParams(searchParams)` 사용 (쿼리 우선).
3. `hasFilterInUrl === false` 이고 `initialFiltersFromServer != null` → **서버 초기값 사용** (랜딩 첫 진입, 쿼리 없을 때만).
4. 나머지 → **쿼리 파싱 결과 사용**.

**검증 결과:**

| 시나리오 | hasLanding | hasFilterInUrl | 동작 | /products 영향 |
|----------|------------|----------------|------|----------------|
| `/products` (쿼리 없음) | false | false | initialFiltersFromServer는 `/products`에서 미전달(null) → 3번 미충족 → 4번으로 parse(빈 객체) → 필터 전부 null | ✅ 기존과 동일 |
| `/products?region=도쿄` | false | true | 2번에서 걸리지 않고 3번도 아님(hasFilterInUrl 있음) → 4번 parse(URL) | ✅ 쿼리 우선 |
| `/products?destination=tokyo` | true | - | 1번에서 initialFiltersFromServer 사용 (resolveLandingParams 결과) | ✅ 기존 랜딩 쿼리 동작 유지 |
| `/products/region/tokyo` (첫 진입) | false | false | 3번 → initialFiltersFromServer 사용 (region: 해당 name) | ✅ 랜딩만 영향 |
| `/products/region/tokyo?theme=골프` (필터 변경 후) | false | true | 3번 미적용 → 4번 parse(URL) | ✅ 서버 초기값이 다시 덮어쓰지 않음 |

**결론:**  
- URL에 필터 쿼리가 있으면 항상 **쿼리 우선** (2번 또는 4번).  
- 랜딩 “첫 진입”(쿼리 없음)일 때만 서버 초기값 적용 (3번).  
- 필터 변경 후에는 URL에 파라미가 생기므로 서버 초기값으로 덮어쓰지 않음.  
- `/products`는 `initialFiltersFromServer`를 넘기지 않으므로 3번 조건을 만족하지 않아 기존과 동일하게 동작함.

---

### 2) region/theme 랜딩의 initialFiltersFromServer 값이 필터/적용 로직과 동일한지

**사용처 정리:**

- **ProductFilterSidebar:**  
  `buildRegionTree(destinations)` / `buildThemeTree(themes)` 의 각 노드 `node.name`을 옵션으로 사용하고, 선택 시 `onFilterChange({ region: node.name })` 또는 `{ theme: node.name }` 로 전달.  
  → 사용하는 값 = **product_taxonomies.name** (지역/테마 taxonomy의 `name` 필드).

- **applyProductFilters (productFilters.ts):**  
  - `filters.region`: `destination_id` → `taxonomyNameMap`으로 **이름** 조회 후 비교, 없으면 `p.category` 와 문자열 비교.  
  - `filters.theme`: `parseThemeTokens(p.theme)` 결과(테마 **이름** 토큰)에 `filters.theme` 포함 여부로 비교.  
  → 사용하는 값 = **taxonomy name 문자열** (예: "도쿄", "문화 / 도시탐방").

- **랜딩에서 넣는 값:**  
  - 지역: `initialFiltersFromServer.region = landingData.taxonomyName`  
  - 테마: `initialFiltersFromServer.theme = landingData.taxonomyName`  
  - `landingData.taxonomyName` = `getProductLandingData()` 내부에서 `getTaxonomyNameBySlug(type === "region" ? "category" : "theme", normalizedSlug)` 로 얻은 값 = **product_taxonomies 행의 `name`** (또는 slug fallback 테이블의 이름).

**결론:**  
- `landingData.taxonomyName`과 사이드바/applyProductFilters가 기대하는 값은 모두 **같은 taxonomy name** (예: "도쿄", "문화 / 도시탐방")이다.  
- region/theme 랜딩에서 넣는 `initialFiltersFromServer` 값은 **ProductFilterSidebar 옵션 및 applyProductFilters와 동일한 문자열**이다.

---

## 5) ProductsPageContent.tsx 실제 diff

```diff
--- a/src/components/products/ProductsPageContent.tsx
+++ b/src/components/products/ProductsPageContent.tsx
@@ -60,11 +60,18 @@ export function ProductsPageContent({
   const filters = useMemo(
     () => {
       const hasLanding =
         searchParams.get("destination") ||
         searchParams.get("city") ||
         searchParams.get("theme");
       if (hasLanding && initialFiltersFromServer != null)
         return initialFiltersFromServer;
+      // 랜딩 하위 페이지(/products/region/[slug], /products/theme/[slug]) 첫 진입 시 쿼리 없이 서버에서 넘긴 초기 필터 사용
+      const hasFilterInUrl =
+        searchParams.get("region") ||
+        searchParams.get("theme") ||
+        searchParams.get("product_line") ||
+        searchParams.get("sort") ||
+        searchParams.get("q");
+      if (!hasFilterInUrl && initialFiltersFromServer != null)
+        return initialFiltersFromServer;
       return parseProductFiltersFromSearchParams(
         Object.fromEntries(searchParams.entries()),
       );
```

---

## 6) 검증 체크리스트

- [ ] 지역 랜딩에서 히어로 유지
- [ ] 지역 랜딩에서 하위지역 카드가 히어로 하단에 그대로 유지
- [ ] 지역 랜딩에서 추천 상품 유지
- [ ] 지역 랜딩 하단에 필터 + 전체상품 목록 추가
- [ ] 지역 랜딩에서 필터 변경 시 `/products/region/[slug]` 경로 유지
- [ ] 테마 랜딩에서 히어로 유지
- [ ] 테마 랜딩에서 하위테마 카드가 히어로 하단에 그대로 유지
- [ ] 테마 랜딩에서 추천 상품 유지
- [ ] 테마 랜딩 하단에 필터 + 전체상품 목록 추가
- [ ] 테마 랜딩에서 필터 변경 시 `/products/theme/[slug]` 경로 유지
- [ ] 기존 `/products` 페이지 동작 영향 없음
- [ ] 타입/린트 에러 없음

---

## 7) 후속 과제

- 없음. 랜딩 상단 UI/순서/리다이렉트 정책은 변경하지 않았으며, 하단에만 필터+목록을 연결함.
