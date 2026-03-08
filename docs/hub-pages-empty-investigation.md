# 지역별/테마별 허브 페이지 비어 있음 원인 점검

## 요약

- **증상**: `/destinations`, `/themes` 사용자 페이지에서 "노출 가능한 항목이 없습니다" 표시. 관리자에서는 지역/테마 항목이 존재하고 대부분 **활성=활성**, **허브 노출=노출**, **랜딩 공개=비공개**.
- **직접 원인(지역 허브)**: `getHubDestinations()`가 **DB 조회 후** `category_type`으로 한 번 더 걸러서, `category_type`이 `destination`이거나 null이 아닌 항목(예: `product_line`, `highlight`, `other`)은 전부 제외됨. 관리자에서 지역 항목의 `category_type`이 대부분 비공개용으로 `other` 등이면 허브 결과가 0건이 됨.
- **직접 원인(테마 허브)**: 조회 조건은 `is_active && is_hub_visible`만 사용하며 `is_landing_enabled`는 섞여 있지 않음. 같은 조건으로 조회해도 비어 있다면 **캐시(stale)** 또는 DB에서 theme 행의 `is_active`/`is_hub_visible`이 false인 경우 가능성 있음.
- **조치**: 지역 허브는 **허브 노출 조건을 `is_active && is_hub_visible`만** 쓰도록 `category_type` 후처리 필터를 제거함. 테마 허브는 조건 변경 없이, 캐시 재검증 또는 DB 값 확인으로 점검.

---

## 1) 허브 페이지에서 사용하는 조회 함수

| 페이지 | 사용 함수 | 정의 위치 |
|--------|-----------|-----------|
| `/destinations` | `getHubDestinations()` | `src/lib/productTaxonomies.ts` |
| `/themes` | `getHubThemes()` | `src/lib/productTaxonomies.ts` |

- 지역: `getHubDestinations()` → 내부 `getHubDestinationsCached()`  
- 테마: `getHubThemes()` → 내부 `getHubThemesCached()`

---

## 2) 허브 조회 조건 (is_active / is_hub_visible / is_landing_enabled)

### 지역 허브 (`getHubDestinationsCached`)

- **Supabase 쿼리**
  - `type = 'category'`
  - `is_active = true`
  - `is_hub_visible = true`
- **추가 후처리(원인)**
  - `category_type`이 **없거나** `'destination'`인 항목만 남김.  
  - 즉 `category_type`이 `product_line` / `highlight` / `other`이면 **전부 제외** → 이 때문에 관리자에는 보이지만 허브에는 안 나올 수 있음.

### 테마 허브 (`getHubThemesCached`)

- **Supabase 쿼리만 사용, 후처리 없음**
  - `type = 'theme'`
  - `is_active = true`
  - `is_hub_visible = true`
- **`is_landing_enabled`는 사용하지 않음** (허브에는 섞여 있지 않음).

### 정리

- 허브 페이지: **`is_active && is_hub_visible`만** 쓰는 것이 맞고, `is_landing_enabled`는 허브에 넣지 않음.
- 상세 랜딩(`/destinations/[slug]`, `/themes/[slug]`)만 `getDestinationBySlugForPublicLanding` / `getThemeBySlugForPublicLanding`에서 **`is_landing_enabled`** 로 공개 여부를 판단함.

---

## 3) is_landing_enabled가 허브에 섞여 있는지

- **허브용 캐시 함수**: `getHubDestinationsCached`, `getHubThemesCached` 모두 쿼리에 `is_landing_enabled` 조건 **없음**.
- **상세 랜딩용**: `getDestinationBySlugForPublicLanding`, `getThemeBySlugForPublicLanding`에서만 `is_landing_enabled === true`인 경우만 반환.
- 따라서 **허브가 비어 있는 이유는 `is_landing_enabled`가 아님**.  
  (지역 허브는 `category_type` 후처리, 테마 허브는 데이터/캐시 가능성.)

---

## 4) 데이터 소스 일치 여부

| 구분 | 데이터 소스 | 테이블 | 타입 조건 |
|------|-------------|--------|-----------|
| `/destinations` | `getHubDestinations()` | `product_taxonomies` | `type = 'category'` |
| `/themes` | `getHubThemes()` | `product_taxonomies` | `type = 'theme'` |
| 관리자 "지역 관리" | API `GET /api/admin/product-taxonomies` | `product_taxonomies` | 클라이언트에서 `type === 'category'` 필터 |
| 관리자 "테마 관리" | 동일 API | 동일 | 클라이언트에서 `type === 'theme'` 필터 |

- `/destinations`는 **지역(category)** 소스, `/themes`는 **테마(theme)** 소스를 보는 것이 맞음.
- 관리자와 사용자 허브가 같은 테이블·같은 타입을 쓰며, 차이는 **허브 쪽의 추가 필터(지역의 경우 category_type)** 와 **캐시**임.

---

## 5) slug / card_image_url / sort_order / usage_count / category_type 영향

- **허브 쿼리**
  - `slug`, `card_image_url`, `sort_order`, `usage_count`로 **조회 조건을 거는 부분 없음**.  
  - 정렬만 `sort_order` asc, `name` asc 사용.
- **실제로 결과를 줄이는 요인**
  - **지역 허브**: `category_type` 후처리만 해당.  
    - `category_type`이 null/undefined 또는 `'destination'`이 아니면 제거됨.
  - **테마 허브**: 별도 필터 없음. 비어 있으면 `is_active`/`is_hub_visible` 또는 캐시/RLS 등 확인 필요.

---

## 6) 수정 사항 및 검증

### 코드 수정

- **`src/lib/productTaxonomies.ts`**  
  - `getHubDestinationsCached`에서 **`category_type` 후처리 제거**.  
  - 허브는 **`is_active && is_hub_visible`인 모든 category**를 노출하도록 변경.  
  - (선택) 주석으로 “지역 탭 UX 정리 시 `category_type === 'destination'`만 노출하는 옵션 가능” 정도만 명시.

### 검증 방법

- 관리자에서 **활성 + 허브 노출**인 지역(category)·테마(theme)가 있다고 가정할 때:
  1. `/destinations`: 해당하는 지역 항목이 카드/칩에 노출되는지 확인.
  2. `/themes`: 해당하는 테마 항목이 노출되는지 확인.
  3. 캐시: `unstable_cache` revalidate(300초) 또는 `CACHE_TAGS.TAXONOMY` revalidate 후 다시 로드해 보기.

---

## 추가 점검: 지역 vs 테마 의미 혼재

- **현재**
  - 지역 탭: `type = 'category'`인 모든 행을 관리자에서 표시. `category_type`은 별도 필드.
  - 테마 탭: `type = 'theme'`인 모든 행 표시.
- **의미 혼재 가능성**
  - **지역 탭**에 테마 성격 항목(예: 골프투어, 파크골프투어)이 들어가려면, 그 항목이 `type = 'category'`로 들어간 경우임. (이 경우 허브 수정 후 지역 허브에 같이 노출될 수 있음.)
  - **테마 탭**에 지역 성격 항목(예: 일본, 태국, 제주도)이 들어가려면, `type = 'theme'`로 저장된 경우임.
- **허브가 비어 있는 직접 원인은 아님**. 다만 이후 UX를 위해:
  - 지역 허브에는 “지역” 성격만 보이도록 하려면, 관리자에서 지역용 항목은 `category_type = 'destination'`으로 두고, 추후 필요 시 `getHubDestinations`에서 다시 `category_type === 'destination'`만 노출하는 옵션을 둘 수 있음.
  - 테마/지역이 탭별로 의미에 맞게 들어가 있는지는 관리자 데이터 정리로 해결하는 것이 좋음.

---

## 참고: 관련 타입·파일

- **타입**: `ProductCategoryType` = `'destination' | 'product_line' | 'highlight' | 'other'` (`src/types/productTaxonomy.ts`)
- **허브 노출 vs 랜딩 공개**: `src/lib/hubVisibility.ts`  
  - `isHubVisible(item)` = `is_active && is_hub_visible`  
  - `isLandingEnabled(item)` = `is_active && is_landing_enabled`
- **캐시 태그**: `CACHE_TAGS.TAXONOMY`, `CACHE_TAGS.HEADER_NAV` → revalidate 시 헤더·허브 목록 갱신
