# PR: 랜딩·하단 상품목록 레이아웃 체계 통일 — 산출물

## 목표

랜딩 상단과 하단 상품목록이 **같은 가로 폭·컨테이너 체계**를 쓰도록 맞춰,  
한 페이지 안에서 “랜딩”과 “검색 툴”이 따로 노는 느낌을 줄이고,  
같은 컨테이너 안에서 이어지는 탐색 페이지처럼 보이게 함.

- **방향:** 랜딩을 넓히지 않고, **하단 상품목록 섹션을 랜딩 기준 폭으로 맞춤.**

---

## 1) 수정 파일 목록

| 파일 | 변경 내용 |
|------|------------|
| `src/app/products/region/[slug]/page.tsx` | 하단 섹션에서 PageContainer 제거, 랜딩과 동일한 max-w-6xl·패딩 래퍼 적용 |
| `src/app/products/theme/[slug]/page.tsx` | 동일 |
| `src/components/products/ProductsPageContent.tsx` | 루트에 `w-full max-w-full` 추가해 부모 폭 안에서만 사용되도록 명시 |

---

## 2) 각 파일별 변경 요약

### region/[slug]/page.tsx, theme/[slug]/page.tsx

- **제거:** `PageContainer` import 및 `PageContainer size="full"` 사용.
- **추가:** 하단 `<section>` 안에 랜딩과 동일한 폭·패딩 체계를 쓰는 래퍼 적용.
  - `max-w-6xl` — ProductLandingPage의 `<main>`과 동일 (1152px).
  - `px-3 sm:px-6 md:px-10` — 랜딩 main과 동일한 좌우 패딩.
  - `mx-auto w-full` — 중앙 정렬 및 폭 100%(최대 max-w-6xl).
  - 세로 패딩은 기존과 비슷하게 `py-8 sm:py-10 md:py-14` 유지.
- 섹션 제목·설명·ProductsPageContent를 `flex flex-col gap-8`로 감싸 기존 간격 유지.

### ProductsPageContent.tsx

- 루트 컨테이너 클래스에 `w-full max-w-full` 추가.
  - 부모보다 넓어지지 않고, 부모 컨테이너 폭(랜딩에서는 max-w-6xl) 안에서만 배치되도록 함.
- `flex gap-8 items-start` 등 기존 레이아웃·기능은 유지.

---

## 3) 실제 diff

### region/[slug]/page.tsx

```diff
--- a/src/app/products/region/[slug]/page.tsx
+++ b/src/app/products/region/[slug]/page.tsx
@@ -14,7 +14,6 @@ import {
 } from "@/lib/productTaxonomies";
 import ProductLandingPage from "@/components/products/landing/ProductLandingPage";
 import { ProductsPageContent } from "@/components/products/ProductsPageContent";
-import { PageContainer } from "@/components/layout/PageContainer";
 import SiteHeader from "@/components/SiteHeader";
 import type { Product } from "@/types/product";
 import type { ProductTaxonomy } from "@/types/productTaxonomy";
@@ -121,18 +120,22 @@ export default async function ProductsRegionSlugPage({ params }: RegionLandingPr
         <section
           className="min-h-screen border-t border-[var(--border)] bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] pt-10 mt-12 sm:mt-16"
           aria-labelledby="products-section-heading"
         >
-          <PageContainer size="full" className="flex flex-col gap-8 py-8 sm:py-10 md:py-14">
-            <h2
+          {/* 랜딩 상단과 동일한 가로 폭·패딩 체계(max-w-6xl, px-3 sm:px-6 md:px-10)로 정렬 */}
+          <div className="mx-auto w-full max-w-6xl px-3 py-8 sm:px-6 sm:py-10 md:px-10 md:py-14">
+            <div className="flex flex-col gap-8">
+              <h2
               id="products-section-heading"
               className="section-heading type-h2 text-[var(--foreground)] first:mt-0"
             >
               {landingData.taxonomyName} 여행 상품 전체 보기
             </h2>
             <p className="section-description type-small text-[var(--text-muted)] -mt-4">
               조건을 변경하여 다양한 상품을 비교해보세요.
             </p>
             <ProductsPageContent
               ...
             />
-          </PageContainer>
+            </div>
+          </div>
         </section>
```

### theme/[slug]/page.tsx

- region과 동일한 패턴으로 PageContainer 제거, `max-w-6xl` + 동일 패딩 래퍼로 교체.

### ProductsPageContent.tsx

```diff
--- a/src/components/products/ProductsPageContent.tsx
+++ b/src/components/products/ProductsPageContent.tsx
@@ -122,7 +122,7 @@ export function ProductsPageContent({
   );
 
   return (
-    <div className="flex gap-8 items-start">
+    <div className="flex w-full max-w-full gap-8 items-start">
       <ProductFilterSidebar
```

---

## 4) 변경 전/후 UI 설명

| 구분 | 변경 전 | 변경 후 |
|------|----------|----------|
| **랜딩 상단** | `max-w-6xl` + `px-3 sm:px-6 md:px-10` (ProductLandingPage main) | 변경 없음 |
| **하단 상품목록** | `PageContainer size="full"` → `max-w-none` + PageContainer 기본 패딩 → **전체 폭**에 가깝게 보임 | `max-w-6xl` + `px-3 sm:px-6 md:px-10` 로 **랜딩과 동일 폭·패딩** |
| **체감** | 상단은 좁은 랜딩, 하단은 풀폭 검색툴처럼 분리됨 | 상단·하단이 같은 컨테이너 시스템 안에 있는 한 페이지처럼 보임 |
| **ProductsPageContent** | 부모가 full이면 전체 폭 사용 | 부모 폭만 사용(`w-full max-w-full`) → 랜딩에서는 max-w-6xl 안에 정렬 |

---

## 5) 검증 결과

- [x] 지역 랜딩 상단과 하단 상품목록의 가로 폭 체계 통일 (동일 max-w-6xl·패딩)
- [x] 테마 랜딩 상단과 하단 상품목록의 가로 폭 체계 통일
- [x] 하단 상품목록이 브라우저 전체 폭의 별도 페이지처럼 보이지 않음
- [x] 좌측 필터 + 우측 목록이 부모 컨테이너(max-w-6xl) 안에서 정렬됨
- [x] 랜딩 히어로/하위카드/추천상품 구조 변경 없음
- [x] `/products` 페이지는 기존대로 PageContainer size="full" 사용 → 영향 없음
- [x] 타입/린트 에러 없음

---

## 6) 하지 않은 것 (PR 제약 준수)

- 필터 로직·applyProductFilters·ProductCatalogSection·ProductFilterSidebar 내부 항목·추천상품 카드·랜딩 히어로/하위카드·CTA/카피·모바일 필터 드로어 구조 변경 없음.
- **폭/컨테이너/레이아웃 정렬만** 수정함.
