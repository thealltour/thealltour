# 카테고리/테마 분류 체계 전면 개편 설계안

## 개요

- **목표**: `category` / `theme` 2분법으로 인한 지역·여행스타일·상품군·운영기획 혼재를 해소하고, 분류 축을 명확히 분리해 허브·필터·헤더·추천·상세 랜딩이 일관되게 동작하도록 함.
- **새 축**: `destination`(지역), `theme`(여행 스타일), `product_line`(상품군), `campaign`(기획/강조), `tag`(선택·보조).

---

## 1) 기존 taxonomy 구조 점검

### 1.1 현재 DB·타입 구조

| 구분 | 현재 구조 | 비고 |
|------|-----------|------|
| **테이블** | `product_taxonomies` | 단일 테이블에 모든 분류 |
| **타입 구분** | `type`: `'category'` \| `'theme'` | 2분법만 존재 |
| **category 보조** | `category_type`: `'destination'` \| `'product_line'` \| `'highlight'` \| `'other'` | category일 때만 사용, 허브 필터에 사용됨(현재는 제거된 상태) |
| **공통 필드** | `name`, `slug`, `is_active`, `sort_order`, `is_hub_visible`, `is_landing_enabled`, `card_*`, `landing_*`, `seo_*` | 타입 무관 |

- **타입 정의**: `src/types/productTaxonomy.ts`  
  - `ProductTaxonomyType = "category" | "theme"`  
  - `ProductCategoryType = "destination" | "product_line" | "highlight" | "other"`

### 1.2 상품(products)과의 연동

| 상품 필드 | 용도 | taxonomy 연동 |
|-----------|------|----------------|
| `category` | 단일 문자열 | `product_taxonomies.type='category'` 중 한 건의 `name`과 1:1 매칭 (지역+상품군 혼재) |
| `theme` | 쉼표/구분자 구분 문자열 | `product_taxonomies.type='theme'`의 `name` 토큰들과 다:다 매칭 (테마+지역 혼재) |

- **필터/헤더**:  
  - `region` = 상품 `category`와 문자열 일치.  
  - `theme` = 상품 `theme` 토큰에 포함 여부.  
- **usage_count**: 관리자에서 category는 `product.category === name`, theme은 `parseThemeTokens(product.theme).includes(name)`로 계산.

### 1.3 사용처 요약

| 사용처 | 조회/필터 조건 | 비고 |
|--------|----------------|------|
| `/destinations` | `getHubDestinations()` → `type='category'`, `is_active`, `is_hub_visible` | 한때 `category_type` 필터 있었음(제거됨) |
| `/themes` | `getHubThemes()` → `type='theme'`, `is_active`, `is_hub_visible` | |
| 헤더 메뉴 | `getHubDestinations()`, `getHubThemes()` | 지역별/테마별 여행 드롭다운 |
| 상품 필터 | `region`(category name), `theme`(theme name), `q` | `productFilters.ts`, `applyProductFilters` |
| 상품 폼/API | `category` 선택, `theme` 토큰 입력 | 관리자 상품 등록·수정 |
| 상세 랜딩 | `getDestinationBySlugForPublicLanding`, `getThemeBySlugForPublicLanding` | `is_landing_enabled` 사용 |
| 추천 섹션 | `home_curated_sections` (별도 테이블) | taxonomy와 직접 연결 아님 |

### 1.4 taxonomy_type 중심 전환 가능성

- **가능함.**  
  - 현재 `type` + `category_type` 조합을 하나의 **`taxonomy_type`** 으로 통합하면,  
    `destination` / `theme` / `product_line` / `campaign` / `tag` 5축을 명확히 표현 가능.  
  - 기존 데이터는 migration 시 `type`+`category_type` → `taxonomy_type` 매핑으로 이전.  
  - 상품 쪽은 단계적으로:  
    - 1단계: 기존 `category`/`theme` 유지하고, taxonomy만 `taxonomy_type` 기준으로 조회/노출 분리.  
    - 2단계(선택): 상품에 `destination`/`product_line`/`campaign`/`tag` 필드 또는 링크 테이블 도입 후, 필터/허브를 새 축에 맞춤.

---

## 2) 타입·DB 설계안

### 2.1 taxonomy_type 정의

```ts
// 새 분류 축 (기존 type + category_type 통합·확장)
export type TaxonomyType =
  | "destination"   // 지역/국가/권역
  | "theme"         // 여행 스타일/목적
  | "product_line"  // 상품군/서비스 라인
  | "campaign"      // 운영 강조/기획전
  | "tag";          // 자유 보조 메타 (선택)
```

### 2.2 product_taxonomies 테이블 개편

**방안 A: 기존 테이블에 컬럼 추가 (권장)**

- `type` 유지(하위 호환) + **`taxonomy_type`** 추가.  
  - migration 후 모든 조회는 `taxonomy_type` 기준.  
  - `type`은 deprecated로 두고, 필요 시 `taxonomy_type`에서 파생해 채움.

```sql
-- Migration: taxonomy_type 추가 및 기존 데이터 매핑
ALTER TABLE product_taxonomies
  ADD COLUMN IF NOT EXISTS taxonomy_type text;

-- 매핑 규칙 (예시)
-- type='category' AND category_type='destination' -> 'destination'
-- type='category' AND category_type IN ('product_line','highlight','other') -> 'product_line' (highlight/other는 campaign으로 갈 수도 있음)
-- type='category' AND category_type IS NULL -> 'destination' (기본 가정)
-- type='theme' -> 'theme' (이름이 지역이면 수동으로 destination 이전 권장)

UPDATE product_taxonomies SET taxonomy_type = 'destination'
WHERE type = 'category' AND (category_type IS NULL OR category_type = 'destination');

UPDATE product_taxonomies SET taxonomy_type = 'product_line'
WHERE type = 'category' AND category_type IN ('product_line','highlight','other');

UPDATE product_taxonomies SET taxonomy_type = 'theme'
WHERE type = 'theme';

-- 이후 NOT NULL + 기본값 설정
ALTER TABLE product_taxonomies
  ALTER COLUMN taxonomy_type SET DEFAULT 'destination',
  ALTER COLUMN taxonomy_type SET NOT NULL;
```

- **unique 제약**: `(taxonomy_type, name)` 또는 `(taxonomy_type, slug)` 로 중복 방지 (타입별로 이름/slug 유일).

**방안 B: type 제거 후 taxonomy_type만 사용**

- `type`, `category_type` 컬럼 제거하고 `taxonomy_type` 만 사용.  
  - 코드 전반에서 `type`/`category_type` 참조 제거 필요.  
  - 방안 A로 안정화한 뒤 2단계에서 진행 권장.

### 2.3 타입 정의 (프론트/API)

```ts
// src/types/productTaxonomy.ts (개편 후)

export type TaxonomyType =
  | "destination"
  | "theme"
  | "product_line"
  | "campaign"
  | "tag";

export type ProductTaxonomy = {
  id: string;
  /** @deprecated taxonomy_type 사용. 하위 호환용 유지 */
  type?: "category" | "theme";
  taxonomy_type: TaxonomyType;
  name: string;
  slug: string | null;
  is_active: boolean;
  sort_order: number | null;
  created_at: string | null;
  is_hub_visible: boolean;
  is_landing_enabled: boolean;
  card_title?: string | null;
  card_description?: string | null;
  card_image_url?: string | null;
  landing_title?: string | null;
  landing_description?: string | null;
  hero_image_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  /** campaign 전용: 기간/우선순위 등 확장용 */
  meta_json?: Record<string, unknown> | null;
};
```

- `category_type` 제거하고 `taxonomy_type` 만 사용.

### 2.4 상품(products) 연동 옵션

**Phase 1 (최소 변경)**  
- 상품 테이블 변경 없음.  
- `category` → “지역”으로 해석하는 경우 destination 이름, “상품군”이면 product_line 이름과 매칭하는 **해석 레이어**만 분리 (기존 필드로 필터/헤더만 taxonomy_type별로 노출).

**Phase 2 (권장)**  
- 상품에 선택 컬럼 추가:  
  - `destination` (또는 `destination_id` FK),  
  - `product_line` (또는 `product_line_id`),  
  - `campaign_ids` (배열/JSON),  
  - `tags` (배열/JSON).  
- 기존 `category`/`theme`는 migration으로 위 필드로 이전 후 deprecated 처리.

**Phase 3 (선택)**  
- `product_taxonomy_links` (product_id, taxonomy_id, taxonomy_type) 로 완전 다:다로 전환.  
- 상품당 destination/theme/product_line/campaign/tag 자유 조합 가능.

---

## 3) 관리자 UI 개편 설계

### 3.1 탭 구조

| 탭 | taxonomy_type | 설명 |
|----|----------------|------|
| **지역 관리** | `destination` | 일본, 태국, 제주도, 호주, 유럽 등 |
| **테마 관리** | `theme` | 가족여행, 럭셔리, 휴양, 벚꽃여행 등 |
| **상품군 관리** | `product_line` | 골프투어, 파크골프투어, 액티비티, 패키지여행 등 |
| **기획/추천 관리** | `campaign` | 마감임박, 추천, 시즌특가, 벚꽃축제 등 |

- `tag`는 1단계에서는 관리자 전용 탭 없이 “태그 목록” 또는 상품 폼 내 자유 입력으로 두고, 필요 시 별도 “태그 관리” 탭 추가.

### 3.2 API·클라이언트 변경

- **GET /api/admin/product-taxonomies**  
  - 쿼리 파라미터: `taxonomy_type` (optional).  
  - 없으면 전체 반환, 있으면 해당 타입만.  
  - 응답에 `taxonomy_type` 포함, 기존 `type`/`category_type`는 호환용으로만 유지.
- **POST/PATCH**  
  - body에 `taxonomy_type` 필수.  
  - 탭별로 생성 시 해당 값 고정 (지역 탭 → `destination` 등).
- **중복 검사**  
  - `(taxonomy_type, name)` 또는 `(taxonomy_type, slug)` 기준으로 동일 타입 내에서만 검사.

### 3.3 화면 동작

- **지역 관리 탭**: `taxonomy_type=destination` 목록만 로드. 추가/수정 시 `taxonomy_type` 서버에 `destination`로 전달.
- **테마 관리 탭**: `theme`만.
- **상품군 관리 탭**: `product_line`만.
- **기획/추천 관리 탭**: `campaign`만.  
  - 카드/랜딩 노출, 기간(meta_json) 등은 추후 확장.
- 각 탭 공통: 활성/비활성, 허브 노출, 랜딩 공개, 정렬, slug, usage_count(해당 타입 기준), 운영 지표(클릭/검색유입 등) 표시.

### 3.4 상품 등록/수정 폼

- **지역(destination)**: 드롭다운 또는 검색 선택 (기존 category와 1:1 대응 시 한 개만 선택 가능).  
- **테마(theme)**: 기존처럼 다중 선택/토큰.  
- **상품군(product_line)**: 드롭다운 1개 또는 다중 선택(설계에 따라).  
- **기획(campaign)**: 다중 선택(선택).  
- **태그(tag)**: 자유 입력 또는 사전 정의 태그에서 선택(선택).  

- Phase 1에서는 기존 `category`/`theme` 필드만 두고, 옵션 목록을 `taxonomy_type`별로 가져와서 “지역” 드롭다운은 destination, “테마”는 theme만 채우도록만 해도 의미 분리가 됨.

---

## 4) 데이터 마이그레이션 가이드

### 4.1 taxonomy 행 매핑 기준

| 현재 (type / category_type) | 새 taxonomy_type | 비고 |
|-----------------------------|------------------|------|
| type=category, category_type=destination 또는 NULL | `destination` | 지역 성격 |
| type=category, category_type=product_line | `product_line` | 골프투어, 파크골프 등 |
| type=category, category_type=highlight / other | `campaign` 또는 `product_line` | “마감임박” 등은 campaign, 애매하면 product_line |
| type=theme, name이 지역명(일본, 태국, 제주도 등) | `destination`으로 **이전** 권장 | 수동 검토 후 새 행 생성 또는 기존 category로 통합 |
| type=theme, name이 여행스타일(가족여행, 럭셔리 등) | `theme` | 유지 |

### 4.2 항목별 매핑 예시

- **→ destination**: 일본, 태국, 베트남, 호주, 제주도, 유럽, 동남아, 미국·남미 등.  
  - 현재 theme에 있던 “일본”, “제주도” 등은 destination 행으로 옮기고, 상품의 theme 문자열에서는 제거 후 destination 쪽으로 반영.
- **→ theme**: 가족여행, 럭셔리, 휴양, 효도여행, 벚꽃여행, 허니문 등.
- **→ product_line**: 골프투어, 파크골프투어, 액티비티, 패키지여행, 맞춤여행 등.  
  - 현재 category로 쓰이던 “골프투어”, “파크골프투어”는 product_line 행으로 이전.
- **→ campaign**: 마감임박, 추천, 시즌특가, 벚꽃축제 등.  
  - 기존 highlight/other 중 기획전 성격은 campaign으로.

### 4.3 상품 데이터 마이그레이션 (Phase 2 시)

- **category**  
  - 값이 destination 이름이면 → `destination` 필드(또는 destination_id)로.  
  - 값이 product_line 이름이면 → `product_line` 필드로.  
  - 둘 다 있을 수 없으므로, 한 상품이 “일본” + “골프투어”를 가진다면 destination=일본, product_line=골프투어로 분리.
- **theme**  
  - 토큰이 destination 이름이면 destination으로 이전하고 theme 문자열에서는 제거.  
  - 토큰이 theme 이름이면 theme 배열에만 유지.  
- **campaign/tag**  
  - 기존 상품 테이블에 없으면, 1차 migration에서는 비워두고 이후 운영으로 채움.

### 4.4 스크립트/순서 제안

1. **product_taxonomies**  
   - `taxonomy_type` 컬럼 추가.  
   - 위 매핑 규칙으로 UPDATE.  
   - NOT NULL 및 unique 제약 추가.
2. **검증**  
   - 타입별 개수, name/slug 중복 여부 확인.
3. **상품**  
   - Phase 2에서 destination/product_line 등 컬럼 추가 후, category/theme 값 기준으로 채우는 배치 실행.  
   - 실행 후 일부 샘플 상품으로 필터/허브 노출 검증.

---

## 5) 허브·필터·헤더 연동 재설계

### 5.1 허브 페이지

| 경로 | 노출 taxonomy_type | 조회 함수 (예시) |
|------|--------------------|------------------|
| `/destinations` | `destination` 만 | `getHubDestinations()` → `taxonomy_type='destination'`, is_active, is_hub_visible |
| `/themes` | `theme` 만 | `getHubThemes()` → `taxonomy_type='theme'`, is_active, is_hub_visible |

- **상품군 허브**  
  - `/product-lines` (또는 `/products?product_line=골프투어`만으로 처리):  
    `taxonomy_type='product_line'` 만 노출.  
  - 필요 시 “상품군별 보기” 메뉴/허브 추가.
- **기획/캠페인**  
  - `/recommended` 기존 유지 + 섹션별로 campaign 노출 또는 별도 “기획전” 페이지에서 `taxonomy_type='campaign'` 노출.

### 5.2 상품 목록 필터

- **쿼리 파라미 확장**  
  - 기존: `region`, `theme`, `q`, `sort`, `tourType`, `destination`, `city`.  
  - 추가: `product_line`, `campaign` (다중 선택 시 `product_line=a&product_line=b` 또는 `campaign=마감임박`).
- **필터 상태**  
  - `ProductFiltersState`에 `product_line: string | null`, `campaign: string | null` (또는 배열) 추가.
- **applyProductFilters**  
  - 상품이 destination/theme/product_line/campaign을 가지는 방식에 맞춰 필터링.  
  - Phase 1: 기존처럼 `category`를 region/destination과 매칭, `theme` 문자열을 theme와 매칭하고, category 값을 product_line 목록과도 매칭해 product_line 필터 지원.
- **URL 정규화**  
  - `mergeFiltersIntoSearchParams`에 `product_line`, `campaign` 반영.  
  - 랜딩 진입용 `destination`/`city`는 기존처럼 정규화 후 제거.

### 5.3 헤더 메뉴

- **지역별 여행**  
  - `getHubDestinations()`가 `taxonomy_type='destination'` 만 반환하도록 변경.  
  - 기존과 동일한 hover 구조, 링크는 `getDestinationLandingHref`.
- **테마별 여행**  
  - `getHubThemes()`가 `taxonomy_type='theme'` 만 반환.  
  - `getThemeLandingHref`.
- **상품군**  
  - 선택: “상품군” 드롭다운 추가 시 `getHubProductLines()` → `taxonomy_type='product_line'`, 링크는 `/product-lines/[slug]` 또는 `/products?product_line=...`.
- **기획**  
  - 추천 메뉴 안에 campaign 노출하거나, “기획전” 메뉴로 `campaign` 목록 노출.

### 5.4 상세 랜딩

- `/destinations/[slug]`: `taxonomy_type='destination'` 인 항목만 slug 조회.  
- `/themes/[slug]`: `taxonomy_type='theme'` 인 항목만.  
- `/product-lines/[slug]` (도입 시): `taxonomy_type='product_line'` 만.  
- `/recommended/[slug]`: 기존 추천 섹션. campaign 랜딩을 여기에 묶을지, 별도 `/campaigns/[slug]` 로 할지는 운영 정책에 따라 결정.

### 5.5 링크 생성

- **hubLandingLinks**  
  - `getDestinationLandingHref` / `getThemeLandingHref` 유지.  
  - `getProductLineLandingHref`, `getCampaignLandingHref` 추가(필요 시).  
  - 모두 `taxonomy_type` 기준으로 slug 조회하도록 내부 수정.

---

## 6) 단계적 이행안

### Phase 1: taxonomy_type 도입 및 조회 분리

- **목표**: DB와 타입에 `taxonomy_type` 추가, 기존 데이터 migration. 코드는 `taxonomy_type` 기준 조회로 전환, 기존 `type`/`category_type`는 제거하거나 deprecated.
- **산출물**:  
  - migration SQL,  
  - `TaxonomyType` 타입 및 `ProductTaxonomy.taxonomy_type`,  
  - `getHubDestinations`/`getHubThemes`가 `taxonomy_type='destination'`/`'theme'` 만 조회.  
- **PR**: 1개 (DB migration + productTaxonomies + 타입).

### Phase 2: 관리자 UI 4탭 전환

- **목표**: “지역 / 테마 / 상품군 / 기획·추천” 4탭, 탭별로 해당 `taxonomy_type`만 CRUD.
- **산출물**:  
  - AdminProductTaxonomyView 탭 4개,  
  - API GET/POST/PATCH에 `taxonomy_type` 반영 및 검증.  
- **PR**: 1~2개 (API + 관리자 UI).

### Phase 3: 데이터 마이그레이션 및 검증

- **목표**: 기존 행에 대한 `taxonomy_type` 매핑 확정, 지역/테마 탭에 섞여 있던 항목 수동 또는 스크립트로 이전.
- **산출물**:  
  - 매핑 테이블/스크립트,  
  - 검증 리포트.  
- **PR**: 1개 (migration 스크립트 + 문서).

### Phase 4: 허브·필터·헤더 조회 변경

- **목표**: 허브/필터/헤더가 전부 `taxonomy_type` 기준으로만 노출.  
  - `/destinations` = destination만, `/themes` = theme만.  
  - 필터에 product_line(, campaign) 추가.  
  - 헤더 메뉴도 동일.
- **산출물**:  
  - productTaxonomies 조회 함수 정리,  
  - productFilters 확장,  
  - headerNavigation, hubLandingLinks 수정.  
- **PR**: 1~2개.

### Phase 5: legacy 제거 및 상품 축 확장 (선택)

- **목표**: `type`/`category_type` 제거, 상품에 destination/product_line/campaign/tag 반영.
- **산출물**:  
  - 상품 스키마 확장 또는 product_taxonomy_links,  
  - applyProductFilters 및 폼을 새 축에 맞게 수정,  
  - legacy 타입/필드 제거.  
- **PR**: 2~3개 (상품 스키마 + 필터/폼 + 정리).

---

## 산출물 요약

### 구체적 개편 설계

- 위 1~5절: 기존 구조 점검, 타입/DB 설계, 관리자 UI, 마이그레이션 가이드, 허브·필터·헤더 재설계, 단계별 이행안.

### 예상 수정 파일 목록

| 영역 | 파일 |
|------|------|
| 타입 | `src/types/productTaxonomy.ts` |
| DB/API | `src/app/api/admin/product-taxonomies/route.ts`, `src/app/api/admin/product-taxonomies/[id]/route.ts` |
| 조회/캐시 | `src/lib/productTaxonomies.ts` |
| 링크/노출 | `src/lib/hubLandingLinks.ts`, `src/lib/hubVisibility.ts` |
| 필터 | `src/lib/productFilters.ts`, `src/lib/productFiltersLanding.ts` |
| 헤더 | `src/lib/headerNavigation.ts` |
| 관리자 UI | `src/components/admin/products/AdminProductTaxonomyView.tsx`, `useAdminProductTaxonomyController.ts`, `adminProductTaxonomy.client.ts` |
| 상품 폼/API | `src/components/admin/products/editor/adminProductForm.*`, `src/app/api/admin/products/[id]/route.ts` |
| 페이지 | `src/app/destinations/page.tsx`, `src/app/themes/page.tsx`, (선택) `src/app/product-lines/page.tsx` |
| 컴포넌트 | `ProductFilterSidebar`, `ProductFilterChips`, `ProductCatalogSection`, (허브 카드 등) |
| 분석/매핑 | `src/lib/adminAnalytics/aggregation.ts` (taxonomy_type 반영) |

### Migration 전략

- **DB**: 단일 테이블에 `taxonomy_type` 추가 후 기존 `type`/`category_type` 매핑으로 backfill.  
  - 필요 시 `(taxonomy_type, name)` unique.  
  - 이후 `type`/`category_type` 제거는 Phase 5.
- **상품**: Phase 1~4에서는 기존 `category`/`theme` 유지.  
  - Phase 5에서 destination/product_line/campaign/tag 컬럼 또는 링크 테이블 도입 후 이전.

### 단계별 PR 분리안

| 단계 | PR | 내용 |
|------|-----|------|
| 1 | PR-TAX-1 | DB migration(taxonomy_type), 타입 정의, getHubDestinations/Themes를 taxonomy_type 기준으로 변경 |
| 2 | PR-TAX-2 | 관리자 API taxonomy_type 검증/저장, GET 필터링 |
| 3 | PR-TAX-3 | 관리자 UI 4탭 (지역/테마/상품군/기획·추천) |
| 4 | PR-TAX-4 | 데이터 마이그레이션 스크립트 및 매핑 문서 반영, 검증 |
| 5 | PR-TAX-5 | 허브/필터/헤더를 taxonomy_type 전용으로 조회, product_line(,campaign) 필터 추가 |
| 6 | PR-TAX-6 (선택) | 상품 스키마 확장, applyProductFilters/폼 연동, type/category_type 제거 |

---

## 참고 문서

- `docs/hub-pages-empty-investigation.md` — 현재 허브 조회 조건 및 category_type 이슈 정리.
- `src/types/productTaxonomy.ts` — 현재 타입 정의.
- `src/lib/productTaxonomies.ts` — getHubDestinations, getHubThemes, getProductTaxonomyOptions 등.
