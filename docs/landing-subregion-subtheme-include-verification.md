# 랜딩 하위지역/하위테마 상품 포함 — 확인 및 수정 결과

## 확인 요청

> 각 랜딩페이지 진입 시 하위지역/테마의 상품은 추천/전체상품 조회 란에서 제외되는 게 아닌지 확인 바랍니다.  
> 예: '해외' 지역 선택 시 하위의 모든 필터가 동작해야 합니다.

---

## 1) 확인 결과 (수정 전 동작)

**기존에는 하위 지역/테마 상품이 제외되고 있었습니다.**

| 구분 | 기존 로직 | 결과 |
|------|-----------|------|
| **추천 상품** | `matchProductsByTaxonomyName`: region은 `p.category === taxonomyName` **완전 일치**만 사용 | '해외' 랜딩 시 `category === '해외'`인 상품만 포함. '일본', '도쿄' 등 하위 지역 상품은 제외됨 |
| **전체 상품 수** | 동일한 `matchProductsByTaxonomyName`로 `matchedAll` 계산 | 동일하게 하위 지역 상품 제외 |
| **하단 필터+목록** | `applyProductFilters`: region은 `destinationName === r` 또는 `p.category === r` **완전 일치**만 사용 | '해외' 선택 시 '해외'만 매칭. 하위 지역 상품 제외 |

즉, **'해외'처럼 상위 지역(또는 상위 테마) 랜딩에서는 하위 지역/테마에 속한 상품이 추천·전체상품 조회 모두에서 빠져 있었습니다.**

---

## 2) 수정 방향

- **taxonomy 계층 활용:** `product_taxonomies`의 `parent_id`로 지역/테마 트리를 구성하고, 선택한 taxonomy의 **자신 + 모든 자손**의 id/name 집합을 구해 매칭에 사용.
- **추천 상품·전체 상품 수:** 랜딩 데이터 로드 시 위 집합을 구해 `matchProductsByTaxonomyName`에 넘겨, 해당 집합에 포함되는 상품만 매칭.
- **하단 필터+목록:** 랜딩에서 내려준 `initialRegionDescendants` / `initialThemeDescendantNames`를 `applyProductFilters`에 넘겨, **현재 선택된 region/theme이 랜딩 초기값과 같을 때만** 하위 포함 집합으로 필터링.

---

## 3) 수정한 파일 및 내용 요약

| 파일 | 변경 요약 |
|------|-----------|
| `src/lib/productTaxonomies.ts` | `getSelfAndDescendantIdsAndNames(nodes, parentName)` 추가. 부모 name에 해당하는 노드와 그 하위 전체의 `id`/`name` 배열 반환. |
| `src/lib/productLanding.ts` | taxonomies에서 destination/theme 목록 추출 후, 랜딩 type에 따라 위 함수로 id/name 집합 계산. `matchProductsByTaxonomyName`에 옵션으로 전달해 추천·matchedAll 모두 **자신+하위** 포함하도록 변경. |
| `src/lib/productFilters.ts` | `ProductFiltersApplyOptions` 타입 추가. `applyProductFilters`에 4번째 인자 `options` 추가. region/theme 필터 시 `regionDescendants`/`themeDescendantNames`가 있고, 현재 필터 값이 랜딩 초기값과 같으면 해당 집합으로 필터링. |
| `src/components/products/ProductsPageContent.tsx` | `initialRegionDescendants`, `initialThemeDescendantNames` prop 추가. `initialFiltersFromServer`와 비교해 동일할 때만 `filterApplyOptions`를 만들어 `applyProductFilters`에 전달. |
| `src/app/products/region/[slug]/page.tsx` | `getSelfAndDescendantIdsAndNames(allDestinations, taxonomyName)`로 `initialRegionDescendants` 계산 후 `ProductsPageContent`에 전달. |
| `src/app/products/theme/[slug]/page.tsx` | `getSelfAndDescendantIdsAndNames(allThemes, taxonomyName).names`로 `initialThemeDescendantNames` 계산 후 `ProductsPageContent`에 전달. |

---

## 4) 수정 후 동작

- **지역 랜딩 (예: 해외)**  
  - 추천 상품: '해외' + 하위 지역(일본, 도쿄 등)에 속한 상품까지 포함.  
  - 전체 상품 수: 동일 기준으로 집계.  
  - 하단 필터+목록: 초기 region='해외'일 때 `initialRegionDescendants`로 필터링하므로 하위 지역 상품까지 노출. 사용자가 region을 다른 값으로 바꾸면 기존처럼 해당 이름 **완전 일치**만 사용.

- **테마 랜딩 (상위 테마)**  
  - 추천·전체 상품 수·하단 목록 모두 해당 테마 + 하위 테마 name 집합으로 매칭.

- **`/products` 등 랜딩이 아닌 페이지**  
  - `initialRegionDescendants`/`initialThemeDescendantNames`를 넘기지 않으므로 기존과 동일하게 **완전 일치**만 사용.

---

## 5) 검증 포인트

- [ ] 지역 랜딩(예: 해외): 추천 상품에 하위 지역 상품이 포함되는지
- [ ] 지역 랜딩: 하단 "전체 상품" 목록에 하위 지역 상품이 포함되는지
- [ ] 테마 랜딩(상위 테마): 추천·전체 상품에 하위 테마 상품이 포함되는지
- [ ] 랜딩에서 region/theme을 다른 값으로 변경하면 기존처럼 해당 값만 정확히 필터되는지
- [ ] `/products` 단독 접근 시 기존과 동일하게 동작하는지
- [ ] 타입/린트 에러 없음
