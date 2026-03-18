# PR 결과: 랜딩 하단 상품카드 전용 compact 레이아웃 적용 (related layout 활용)

## PR 제목

랜딩 하단 상품카드 전용 compact 레이아웃 적용 (related layout 활용)

---

## 목표

랜딩 하단 상품카드가 `/products` 목록 카드(list layout)와 동일한 밀도로 렌더링되며 가독성이 떨어지고 조잡해 보이던 문제를 해결했습니다.  
기존 **ProductCard**의 **`related`** 레이아웃을 활용해 랜딩 전용 compact 카드로 전환했습니다.

---

## 핵심 변경 사항

### 1) 랜딩 하단에서만 ProductCard layout을 "related"로 사용

- **`/products`** → 기존 **list** 유지 (ProductListCard / ProductListCardMobile)
- **랜딩 하단** → **related** 사용 (ProductCard + ProductCardGridSection)

랜딩 여부는 **`cardLayout`** prop으로 명시적으로 구분합니다.

### 2) 랜딩 여부 분기

- **ProductsPageContent**: `cardLayout?: "list" | "related"` 추가 (기본값 `"list"`).
- **ProductCatalogSection**: 동일한 `cardLayout` 수신 후,  
  `cardLayout === "related"`일 때만 **ProductCard**에 `layout="related"` 및 `analyticsSource="landing"`, `analyticsSection="landing_catalog"`를 넘겨 렌더링.
- 랜딩 페이지 4곳에서만 **`cardLayout="related"`**를 넘김.

```tsx
// ProductCatalogSection 내부
{cardLayout === "related" ? (
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
) : (
  // 기존 ProductListCard / ProductListCardMobile
)}
```

### 3) related 레이아웃으로 자동 제거되는 요소

**ProductCard**의 기존 **relatedCardContent** 구조를 그대로 사용하여, 랜딩 하단에서는 아래가 노출되지 않습니다.

- 숙소 / 지역 / 기간 박스
- 해시태그 리스트
- 상담 버튼
- 상세보기 버튼

→ 이미지(4:3) + 기간 뱃지 + 타이틀 + 가격 중심의 compact 카드만 노출됩니다.

### 4) related 카드 스타일 (미수정)

- **ProductCard** 내부의 **relatedCardContent** 및 related 전용 스타일은 **수정하지 않음**.
- 레이아웃 분기만 추가하고, 기존 related 구조를 그대로 재사용했습니다.

### 5) 적용 위치

랜딩 하단 "전체상품 기반 조회 섹션"에서만 **`cardLayout="related"`** 적용:

| 페이지 | 파일 | 적용 |
|--------|------|------|
| Region 랜딩 하단 | `src/app/products/region/[slug]/page.tsx` | `cardLayout="related"` |
| Theme 랜딩 하단 | `src/app/products/theme/[slug]/page.tsx` | `cardLayout="related"` |
| Destination 상세 하단 | `src/app/destinations/[slug]/page.tsx` | `cardLayout="related"` |
| Theme 상세 하단 | `src/app/themes/[slug]/page.tsx` | `cardLayout="related"` |
| /products 본문 | `src/app/products/page.tsx` | `cardLayout` 미전달 → 기본 `"list"` 유지 |

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/ProductCatalogSection.tsx` | `cardLayout` prop 추가, `cardLayout === "related"` 시 ProductCard + ProductCardGridSection 사용 |
| `src/components/products/ProductsPageContent.tsx` | `cardLayout` prop 추가 후 ProductCatalogSection에 전달 |
| `src/app/products/region/[slug]/page.tsx` | ProductsPageContent에 `cardLayout="related"` 전달 |
| `src/app/products/theme/[slug]/page.tsx` | ProductsPageContent에 `cardLayout="related"` 전달 |
| `src/app/destinations/[slug]/page.tsx` | ProductsPageContent에 `cardLayout="related"` 전달 |
| `src/app/themes/[slug]/page.tsx` | ProductsPageContent에 `cardLayout="related"` 전달 |

---

## 검증 항목

- [x] 랜딩 하단 카드가 related 레이아웃으로 높이·스타일 균일
- [x] ProductCardGridSection으로 카드 간 간격(2열 그리드) 적용
- [x] 이미지·타이틀·가격 중심으로 스크롤 가독성 개선
- [x] 카드 클릭 시 `hrefDetail`로 상세 페이지 정상 이동
- [x] `/products` 페이지는 기존 list 카드(ProductListCard/ProductListCardMobile) 유지, UI 변경 없음

---

## 기대 효과

- 랜딩(탐색·선택)과 목록(비교·상세 진입) 역할 분리
- 랜딩 하단 = 탐색·선택 중심 UX 강화
- 카드 정보 밀도 감소로 가독성 개선 및 체류시간 증가 기대
- 브랜드 톤 일관성 회복

---

## 주의 사항 (준수 여부)

- **list 레이아웃 미수정**: ProductListCard / ProductListCardMobile 및 list 전용 로직 변경 없음.
- **랜딩 전용 로직만 분리**: `cardLayout`으로 랜딩 시에만 related 경로 사용.
- **ProductCard 공용 구조 유지**: relatedCardContent 및 기존 layout 분기 구조 그대로 사용.
