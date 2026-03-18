# PR1: 상품 필터/목록 엔진 basePath 공용화 — 산출물

## 목표

`/products` 전용으로 하드코딩된 필터/목록 엔진의 라우팅 경로를 공용화해서,  
향후 `/products/region/[slug]`, `/products/theme/[slug]` 같은 랜딩 하위 페이지에서도  
동일한 `ProductsPageContent`를 재사용할 수 있도록 `basePath` 개념을 추가.

**범위:** 경로 공용화 리팩토링만. 랜딩 페이지에 목록 붙이기는 후속 PR에서 수행.

---

## 1) 수정한 파일 목록

- `src/components/products/ProductsPageContent.tsx` (1개 파일만 수정)

---

## 2) 각 파일별 핵심 변경 사항 요약

### `src/components/products/ProductsPageContent.tsx`

- **A. props 타입 확장:** `ProductsPageContentProps`에 optional `basePath?: string` 추가.
- **B. 컴포넌트 인자 기본값:** 구조분해 시 `basePath = "/products"` 지정.
- **C. handleFilterChange 라우팅:** `router.push(qs ? "/products?..." : "/products")` → `router.push(qs ? \`${basePath}?${qs}\` : basePath)` 로 변경.
- **D. 그 외:** filters 계산, initialFiltersFromServer, baseProducts/filteredProducts, ProductFilterChips, ProductCatalogSection 등 나머지 로직·UI는 변경 없음.

### `src/app/products/page.tsx`

- 수정 없음. basePath를 넘기지 않아도 기본값 `"/products"`로 기존과 동일하게 동작.

---

## 3) 실제 diff

```diff
--- a/src/components/products/ProductsPageContent.tsx
+++ b/src/components/products/ProductsPageContent.tsx
@@ -34,6 +34,8 @@ export type ProductsPageContentProps = {
   productLineOptions: string[];
   initialKeyword?: string;
   presetCategories?: string[];
   presetLabel?: string;
   /** 랜딩(destination/city/theme slug) 진입 시 서버에서 해석한 초기 필터 */
   initialFiltersFromServer?: ProductFiltersState | null;
+  /** 필터 변경 시 라우팅 기준 경로. 기본값 /products. 랜딩 하위에서 재사용 시 해당 경로 전달 */
+  basePath?: string;
 };
 
@@ -48,6 +50,7 @@ export function ProductsPageContent({
   presetCategories,
   presetLabel,
   initialFiltersFromServer = null,
+  basePath = "/products",
 }: ProductsPageContentProps) {
   const router = useRouter();
@@ -84,7 +87,7 @@ export function ProductsPageContent({
       ...next,
     });
     const qs = nextParams.toString();
-    router.push(qs ? `/products?${qs}` : "/products");
+    router.push(qs ? `${basePath}?${qs}` : basePath);
   }
```

---

## 4) 체크리스트

- [x] `/products` 기존 동작 유지
- [x] `basePath` prop 추가 완료
- [x] 라우팅 하드코딩 제거 완료
- [x] 추가 기능 변경 없음
- [x] 타입/린트 에러 없음

---

## 후속 PR에서의 사용 예

랜딩 페이지에서 `ProductsPageContent`를 사용할 때 `basePath`만 넘기면 됨.

```tsx
<ProductsPageContent
  basePath={`/products/region/${slug}`}
  products={products}
  // ... 기타 props
/>
```

필터 변경 시 해당 경로 기준으로 쿼리스트링만 갱신되며, `/products`로 튀지 않음.
