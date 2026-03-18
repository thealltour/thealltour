# PR1: 랜딩 추천 상품 그리드 열 수 조정 — 산출물

## 목표

랜딩 하단 추천 상품 카드가 데스크톱에서 작아 보이는 문제를 **가장 낮은 리스크로 1차 개선**.  
카드 구조 변경 없이 **데스크톱 그리드만 3열 → 2열**로 변경해 카드 가로폭 확대.

---

## 1) 수정한 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/products/ProductCardGridSection.tsx` | `desktopGridCols` prop 추가, 2/3열 분기 |
| `src/components/products/landing/ProductLandingPage.tsx` | 추천 상품 섹션에 `desktopGridCols={2}` 전달 |

**참고:** `ProductCardGridSection`은 홈·검색·가이드·관련 상품 등 여러 곳에서 사용됩니다.  
**랜딩 추천 상품에만** 2열을 적용하려면 공용 컴포넌트에 선택 prop을 두고, 랜딩에서만 `desktopGridCols={2}`를 넘기도록 했습니다.  
다른 호출부는 prop 미전달 → 기본값 3열 유지.

---

## 2) 핵심 변경 사항 요약

### `ProductCardGridSection.tsx`

- **Props:** `desktopGridCols?: 2 | 3` 추가, 기본값 `3`.
- **그리드 클래스:**  
  - `desktopGridCols === 2` → `hidden sm:grid sm:grid-cols-2 lg:grid-cols-2 sm:gap-4`  
  - 그 외 → 기존 `hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4`
- 모바일(가로 스크롤), sm(2열), gap, max-width, 섹션 래퍼/자식 렌더링 로직은 **변경 없음**.

### `ProductLandingPage.tsx`

- 추천 상품용 `<ProductCardGridSection>`에 `desktopGridCols={2}` 추가.
- 제목·설명·map·CTA·빈 상태 등 나머지 코드 **변경 없음**.

---

## 3) 실제 diff

### ProductCardGridSection.tsx

```diff
--- a/src/components/products/ProductCardGridSection.tsx
+++ b/src/components/products/ProductCardGridSection.tsx
@@ -4,13 +4,16 @@ export type ProductCardGridSectionProps = {
   /** 카드 목록 (보통 ProductCard 컴포넌트들). key는 각 카드에 부여해야 함. */
   children: React.ReactNode;
   className?: string;
+  /** 데스크톱(lg) 그리드 열 수. 기본 3열. 랜딩 추천 상품 등 카드 폭을 넓히고 싶을 때 2로 설정 */
+  desktopGridCols?: 2 | 3;
 };
 
 /**
  * /recommended와 동일한 상품 카드 노출 방식.
  * - 모바일: 가로 스크롤 (카드당 min-w-[78%] max-w-[320px])
- * - 데스크톱: 그리드 2열(sm) / 3열(lg), 최대 너비 1344px
+ * - 데스크톱: 그리드 2열(sm) / 2열 또는 3열(lg, desktopGridCols prop), 최대 너비 1344px
  * 메인 홈 추천, /recommended, 검색 결과, 랜딩, 가이드 관련 상품 등에서 공통 사용.
+ * 랜딩 추천 상품은 desktopGridCols={2}로 2열 사용.
  */
 export function ProductCardGridSection({
   children,
   className,
+  desktopGridCols = 3,
 }: ProductCardGridSectionProps) {
@@ -36,7 +39,12 @@ export function ProductCardGridSection({
           ))}
         </div>
-        {/* 데스크톱: 그리드 2열 → 3열 */}
-        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
+        {/* 데스크톱: 그리드 2열(sm) / desktopGridCols열(lg). 랜딩 추천은 2열로 카드 폭 확대 */}
+        <div
+          className={
+            desktopGridCols === 2
+              ? "hidden sm:grid sm:grid-cols-2 lg:grid-cols-2 sm:gap-4"
+              : "hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4"
+          }
+        >
           {items}
         </div>
       </div>
```

### ProductLandingPage.tsx

```diff
--- a/src/components/products/landing/ProductLandingPage.tsx
+++ b/src/components/products/landing/ProductLandingPage.tsx
@@ -244,7 +244,7 @@
             ) : (
               <>
-                <ProductCardGridSection>
+                <ProductCardGridSection desktopGridCols={2}>
                   {uniqueRecommendedProducts.map((item) => (
                     <ProductCard
```

---

## 4) 변경 전/후 UI 설명

| 구분 | 변경 전 | 변경 후 |
|------|---------|---------|
| **랜딩 추천 상품 (데스크톱)** | lg에서 3열, 카드 가로폭 약 1/3 | lg에서 2열, 카드 가로폭 약 1/2로 확대 |
| **랜딩 추천 상품 (모바일/태블릿)** | 가로 스크롤 / sm 2열 | 동일 |
| **홈·검색·가이드·관련 상품** | lg 3열 | 변경 없음 (prop 미전달 → 3열 유지) |
| **카드 내부** | ProductCard layout="grid" 등 | 변경 없음 |

- 2개·3개·4개일 때: 2열이면 마지막 줄에 1개만 남는 경우 있음. 그리드 특성상 흔한 패턴이며, 카드 폭이 넓어져서 자연스럽게 보이도록 유지.

---

## 5) 검증 결과

- [x] 추천 상품 섹션 데스크톱 2열 적용 (랜딩에서만 `desktopGridCols={2}`)
- [x] 모바일/태블릿 기존 흐름 유지 (가로 스크롤, sm 2열 동일)
- [x] 카드 내부 구조 변경 없음 (ProductCard 등 미수정)
- [x] 랜딩 상단/하단 다른 섹션 영향 없음 (히어로·하위 카드·필터 목록 그대로)
- [x] `/products` 전체상품 목록 영향 없음 (해당 페이지는 ProductCardGridSection 미사용 또는 동일 컴포넌트 3열 유지)
- [x] 타입/린트 에러 없음

---

## 6) 체크리스트

- [x] 추천 상품 섹션 데스크톱 2열 적용
- [x] 모바일/태블릿 기존 흐름 유지
- [x] 카드 내부 구조 변경 없음
- [x] 랜딩 상단/하단 다른 섹션 영향 없음
- [x] 타입/린트 에러 없음
