# PR3: 랜딩 하단 필터+상품목록 UX 보정 — 산출물

## 목표

랜딩 페이지(`/products/region/[slug]`, `/products/theme/[slug]`) 하단 필터+상품목록 섹션의 **UX 완성도 개선**만 수행. 기능/로직 변경 없음.

- 하단 상품목록 섹션 맥락 명확화
- 현재 적용된 필터 상태 직관적 표시
- 초기화 = 랜딩 기본 상태로 복귀
- 랜딩 → 필터 영역 시각적 구분
- 모바일 spacing 점검

---

## 1) 수정 파일 목록

| 파일 | 변경 성격 |
|------|------------|
| `src/app/products/region/[slug]/page.tsx` | 섹션 래퍼·제목·설명·filterContextLabel 전달 |
| `src/app/products/theme/[slug]/page.tsx` | 동일 |
| `src/components/products/ProductsPageContent.tsx` | filterContextLabel prop·안내 문구·초기화 시 랜딩 기본값 복귀 |

**미수정:** `ProductFilterChips.tsx` — 칩 구조 변경 없이, 상단 안내 문구는 부모(ProductsPageContent)에서 렌더.

---

## 2) 각 파일 변경 요약

### `src/app/products/region/[slug]/page.tsx`

- 하단 블록을 `<div>` → `<section>`으로 변경.
- `section`에 `border-t border-[var(--border)]`, `pt-10`, `mt-12 sm:mt-16` 적용해 추천 상품과 시각적 구분.
- `PageContainer` 내부에 **섹션 제목** 추가:
  - `<h2 id="products-section-heading">` + `{landingData.taxonomyName} 여행 상품 전체 보기`
  - `<p className="section-description ...">조건을 변경하여 다양한 상품을 비교해보세요.</p>`
- `ProductsPageContent`에 `filterContextLabel={`현재 '${landingData.taxonomyName}' 기준으로 상품을 보여주고 있습니다.`}` 전달.

### `src/app/products/theme/[slug]/page.tsx`

- 지역 랜딩과 동일하게 `<section>` + 제목·설명·spacing 적용.
- `filterContextLabel={`현재 '${landingData.taxonomyName}' 테마 기준 결과입니다.`}` 전달.

### `src/components/products/ProductsPageContent.tsx`

- **Props:** `filterContextLabel?: string | null` 추가.
- **안내 문구:** `filterContextLabel`이 있으면 `ProductFilterChips` 위에 `<p role="status">`로 표시. 칩과 `space-y-2`로 묶음.
- **초기화 동작:** `handleResetFilters` 도입.
  - `initialFiltersFromServer != null`이면 `handleFilterChange(initialFiltersFromServer)` 호출(이미 q/sort는 null/"").
  - 아니면 기존처럼 `handleFilterChange({ region: null, theme: null, product_line: null, q: null, sort: "" })`.
- `ProductCatalogSection`의 `onResetFilters`와 `MobileProductFilterDrawer`의 `onReset`에 `handleResetFilters` 연결.

---

## 3) 실제 diff

### region/[slug]/page.tsx

```diff
--- a/src/app/products/region/[slug]/page.tsx
+++ b/src/app/products/region/[slug]/page.tsx
@@ -112,18 +112,32 @@ export default async function ProductsRegionSlugPage({ params }: RegionLandingPr
     return (
       <>
         <SiteHeader activeTab="products" />
         <ProductLandingPage data={dataWithChildren} />
-        <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)]">
-          <PageContainer size="full" className="flex flex-col gap-8 py-8 sm:py-10 md:py-14">
+        <section
+          className="min-h-screen border-t border-[var(--border)] bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] pt-10 mt-12 sm:mt-16"
+          aria-labelledby="products-section-heading"
+        >
+          <PageContainer size="full" className="flex flex-col gap-8 py-8 sm:py-10 md:py-14">
+            <h2
+              id="products-section-heading"
+              className="section-heading type-h2 text-[var(--foreground)] first:mt-0"
+            >
+              {landingData.taxonomyName} 여행 상품 전체 보기
+            </h2>
+            <p className="section-description type-small text-[var(--text-muted)] -mt-4">
+              조건을 변경하여 다양한 상품을 비교해보세요.
+            </p>
             <ProductsPageContent
               products={products}
               taxonomyNameMap={taxonomyNameMap}
               regionOptions={categories}
               regionTree={regionTree}
               themeOptions={themes}
               themeTree={themeTree}
               productLineOptions={productLines}
               initialFiltersFromServer={initialFiltersFromServer}
               basePath={`/products/region/${trimmedSlug}`}
+              filterContextLabel={`현재 '${landingData.taxonomyName}' 기준으로 상품을 보여주고 있습니다.`}
             />
           </PageContainer>
-        </div>
+        </section>
       </>
     );
```

### theme/[slug]/page.tsx

```diff
--- a/src/app/products/theme/[slug]/page.tsx
+++ b/src/app/products/theme/[slug]/page.tsx
@@ -111,18 +111,32 @@ export default async function ProductsThemeSlugPage({ params }: ThemeLandingProp
     return (
       <>
         <SiteHeader activeTab="products" />
         <ProductLandingPage data={dataWithChildren} />
-        <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)]">
-          <PageContainer size="full" className="flex flex-col gap-8 py-8 sm:py-10 md:py-14">
+        <section
+          className="min-h-screen border-t border-[var(--border)] bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] pt-10 mt-12 sm:mt-16"
+          aria-labelledby="products-section-heading"
+        >
+          <PageContainer size="full" className="flex flex-col gap-8 py-8 sm:py-10 md:py-14">
+            <h2
+              id="products-section-heading"
+              className="section-heading type-h2 text-[var(--foreground)] first:mt-0"
+            >
+              {landingData.taxonomyName} 여행 상품 전체 보기
+            </h2>
+            <p className="section-description type-small text-[var(--text-muted)] -mt-4">
+              조건을 변경하여 다양한 상품을 비교해보세요.
+            </p>
             <ProductsPageContent
               products={products}
               taxonomyNameMap={taxonomyNameMap}
               regionOptions={categories}
               regionTree={regionTree}
               themeOptions={themes}
               themeTree={themeTree}
               productLineOptions={productLines}
               initialFiltersFromServer={initialFiltersFromServer}
               basePath={`/products/theme/${trimmedSlug}`}
+              filterContextLabel={`현재 '${landingData.taxonomyName}' 테마 기준 결과입니다.`}
             />
           </PageContainer>
-        </div>
+        </section>
       </>
     );
```

### ProductsPageContent.tsx

```diff
--- a/src/components/products/ProductsPageContent.tsx
+++ b/src/components/products/ProductsPageContent.tsx
@@ -36,6 +36,8 @@ export type ProductsPageContentProps = {
   /** 필터 변경 시 라우팅 기준 경로. 기본값 /products. 랜딩 하위에서 재사용 시 해당 경로 전달 */
   basePath?: string;
+  /** 랜딩 페이지에서 칩 상단에 표시할 안내 문구 (예: "현재 '도쿄' 기준으로 상품을 보여주고 있습니다.") */
+  filterContextLabel?: string | null;
 };
 
 export function ProductsPageContent({
@@ -50,6 +52,7 @@ export function ProductsPageContent({
   initialFiltersFromServer = null,
   basePath = "/products",
+  filterContextLabel = null,
 }: ProductsPageContentProps) {
   const router = useRouter();
   const searchParams = useSearchParams();
@@ -102,6 +105,16 @@ export function ProductsPageContent({
   const sortLabel = filters.sort
     ? SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? null
     : null;
+
+  const handleResetFilters = () => {
+    if (initialFiltersFromServer != null) {
+      handleFilterChange({
+        ...initialFiltersFromServer,
+        q: null,
+        sort: "",
+      });
+    } else {
+      handleFilterChange({ region: null, theme: null, product_line: null, q: null, sort: "" });
+    }
+  };
 
   return (
     <div className="flex gap-8 items-start">
@@ -127,11 +140,20 @@ export function ProductsPageContent({
           </button>
         </div>
 
-        <ProductFilterChips
+        <div className="space-y-2">
+          {filterContextLabel && (
+            <p className="type-small text-[var(--text-muted)]" role="status">
+              {filterContextLabel}
+            </p>
+          )}
+          <ProductFilterChips
           filters={filters}
           onRemoveRegion={() => handleFilterChange({ region: null })}
           onRemoveTheme={() => handleFilterChange({ theme: null })}
           onRemoveProductLine={() => handleFilterChange({ product_line: null })}
           onRemoveKeyword={() => handleFilterChange({ q: null })}
           onRemoveSort={() => handleFilterChange({ sort: "" })}
-        />
+          />
+        </div>
 
         <ProductCatalogSection
@@ -162,7 +184,7 @@ export function ProductsPageContent({
           onCategoryChange={(region) => handleFilterChange({ region: region ?? null })}
           onThemeChange={(theme) => handleFilterChange({ theme: theme ?? null })}
-          onResetFilters={() => handleFilterChange({ region: null, theme: null, product_line: null, q: null })}
+          onResetFilters={handleResetFilters}
         />
       </div>
 
@@ -174,7 +196,7 @@ export function ProductsPageContent({
         filters={filters}
         onApply={(next) => handleFilterChange(next)}
-        onReset={() => handleFilterChange({ region: null, theme: null, product_line: null })}
+        onReset={handleResetFilters}
       />
```

---

## 4) UI 변경 전/후

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| **섹션 구분** | 추천 상품 바로 아래 필터/목록, 구분선 없음 | 상단 `border-t`, `mt-12 sm:mt-16`, `pt-10`으로 영역 구분 |
| **섹션 제목** | 없음 | "도쿄 여행 상품 전체 보기" / "문화 · 도시탐방 여행 상품 전체 보기" + 설명 문구 |
| **필터 맥락** | 칩만 있음, 기본 적용 여부 불명확 | 칩 위에 "현재 '도쿄' 기준으로 상품을 보여주고 있습니다." 등 안내 문구 표시 |
| **필터 초기화** | 항상 전체 해제(region/theme 등 모두 null) | 랜딩에서는 해당 랜딩 기본값(region 또는 theme 유지)으로 복귀 |
| **모바일** | 기존 gap 유지 | 구조 변경 없이 기존 `space-y-4`·`gap-2`·`flex-wrap` 유지 |

---

## 5) 검증 결과

- [x] 랜딩 상단 UI(히어로, 하위지역/테마 카드, 추천상품) 그대로 유지
- [x] 하단에 "전체 상품 보기" 섹션 타이틀·설명 표시
- [x] 현재 적용된 기본 필터 상태가 안내 문구로 명확히 표시
- [x] 필터 초기화 시 랜딩에서는 해당 랜딩 기본 상태로 복귀 (`initialFiltersFromServer` 기준)
- [x] `/products` 페이지는 `filterContextLabel`·`initialFiltersFromServer` 미전달 → 기존 UX 유지
- [x] 모바일에서 레이아웃 깨짐 없음 (spacing만 사용, 구조 변경 없음)
- [x] 타입/린트 에러 없음

---

## 6) 하지 않은 것 (PR 제약 준수)

- 필터 로직·applyProductFilters·상품 카드 UI·ProductFilterSidebar 구조·ProductLandingPage 내부·상태관리·페이지네이션·API/데이터 구조 변경 없음.
- ProductFilterSidebar 내부 "필터 초기화" 버튼은 그대로 전체 해제 동작 유지(구조 변경 금지로 인해). 빈 결과/모바일 드로어의 초기화만 랜딩 기본값으로 동작.
