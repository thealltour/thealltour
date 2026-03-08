# PR-7B: 랜딩 → 상품 목록 End-to-End QA 및 예외 케이스

## 1. 랜딩 진입 쿼리 해석 흐름

### 1.1 진입용 파라미 (URL 쿼리)

| 쿼리 키 | 의미 | 해석 결과 |
|--------|------|-----------|
| `destination` | 지역 slug (예: japan) | `getDestinationBySlug` → 성공 시 `region`(이름), 실패 시 `getTaxonomyNameBySlug("category", slug)` → 그래도 없으면 `region = null` |
| `city` | 도시/세부 키워드 | `q`(검색어)로 사용. `q`가 없을 때만 city가 keyword로 합쳐짐 |
| `theme` | 테마 slug 또는 이름 | `getThemeBySlug` → 성공 시 `theme`(이름), 실패 시 `getTaxonomyNameBySlug("theme", ...)` → 없으면 쿼리값 그대로 theme 이름으로 사용 |
| `q` | 검색어 | 그대로 `q`로 사용 (city보다 우선) |
| `sort` | 정렬 | `popular` / `latest` / `new` 만 유효, 나머지 무시 |

- **파일**: `src/lib/productFiltersLanding.ts`
  - `hasLandingParams(query)`: `destination` / `city` / `theme` 중 하나라도 있으면 `true`
  - `resolveLandingParams(query)`: 위 규칙으로 `initialFilters`(region, theme, q, sort) + `initialKeyword` 반환

### 1.2 변환 요약

- `destination` → **region** (이름)
- `city` → **q** (키워드)
- `theme`(slug) → **theme** (이름, 조회 실패 시 쿼리값 그대로)
- 해석 실패(예: `destination=unknown-place`): 해당 필드는 `null`, 일반 목록으로 안전 전환

### 1.3 URL 정규화 (사용자 조작 후)

- **파일**: `src/lib/productFilters.ts` → `mergeFiltersIntoSearchParams`
- 칩 제거 / 정렬 변경 / 필터 변경 시:
  - **제거**: `destination`, `city` (진입용 쿼리)
  - **유지·반영**: `region`, `theme`, `q`, `sort` 만으로 URL 재구성
- 따라서 한 번이라도 필터를 건드리면 URL은 `region` / `theme` / `q` / `sort` 중심으로 정리됨.

---

## 2. 확장 시 참고 (style / spot / subdestination)

- `destination`, `city`, `theme` 와 동일하게 **“조회 기반”** 으로 처리할 수 있도록 `productFiltersLanding.ts` 구조 유지.
- 새 키 추가 시:
  1. `hasLandingParams` 에 존재 여부 추가
  2. `resolveLandingParams` 에서 slug → 이름 조회 후 `initialFilters` 에 매핑
  3. `mergeFiltersIntoSearchParams` 에서 진입용 키는 제거, 정규화된 키만 유지

---

## 3. QA 체크리스트

아래 시나리오를 수동으로 점검할 때 사용.

| # | 시나리오 | URL 예시 | 기대 동작 | 확인 |
|---|----------|----------|-----------|------|
| 1 | destination only | `/products?destination=japan` | region=일본(등 해당 이름)으로 필터, 결과 노출 | ☐ |
| 2 | destination + city | `/products?destination=japan&city=tokyo` | region + q(tokyo) 적용, 칩에 지역·키워드 표시 | ☐ |
| 3 | destination + theme | `/products?destination=japan&theme=golf-travel` | region + theme 적용, 둘 다 칩에 표시 | ☐ |
| 4 | theme only | `/products?theme=golf-travel` | theme만 적용, slug가 이름으로 해석되어 결과 노출 | ☐ |
| 5 | city only | `/products?city=tokyo` | q=tokyo 적용, 0건이어도 페이지 깨지지 않고 빈 결과 UI | ☐ |
| 6 | invalid slug | `/products?destination=unknown-place` | 전체 페이지 안 깨짐, region=null 등으로 일반 목록 | ☐ |
| 7 | 칩 제거 | 위 조합 후 지역/테마/키워드 칩 X 클릭 | URL에서 해당 파라미만 제거, `destination`/`city` 중복 없이 정규화 | ☐ |
| 8 | 정렬 변경 | 랜딩 진입 후 정렬 변경 | URL에 `sort=popular` 등만 추가·유지, 진입용 쿼리 제거 | ☐ |
| 9 | no result fallback | 조건 부여 후 결과 0건 | 현재 조건 안내 + "전체 상품 보기" + "필터 초기화" CTA 노출 | ☐ |

---

## 4. 수정/점검 파일 요약

- `src/app/products/page.tsx` — 랜딩 해석 후 `initialFilters` / `initialKeywordFromLanding` 전달
- `src/lib/productFiltersLanding.ts` — `resolveLandingParams`, `hasLandingParams`, 해석 실패 시 안전 전환 주석
- `src/lib/productFilters.ts` — `mergeFiltersIntoSearchParams` (destination/city 제거, 정규화 주석)
- `src/components/products/ProductsPageContent.tsx` — 초기 필터/키워드, `onResetFilters` 전달
- `src/components/products/ProductFilterChips.tsx` — 칩 제거 시 URL 갱신, 키워드 라벨 개선 여지 주석
- `src/components/ProductCatalogSection.tsx` — 0건 시 조건 안내 + 전체 상품 보기 / 필터 초기화 CTA
- 랜딩 카드 링크: `src/lib/landingSubnodes.ts` → `getLandingSubnodeHref` → `buildProductsFilterHref`
