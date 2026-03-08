# 상품 스키마 Taxonomy 축 확장 설계 (PR-TAX-6)

## 1. 목표

- 상품이 **category 단일 문자열 + theme 토큰 문자열**에만 의존하는 구조를 점진적으로 해소한다.
- 상품이 **destination / theme / product_line / campaign / tag**를 명확히 가질 수 있게 하여, 필터/허브/랜딩 정확도를 높인다.
- 이 PR은 **범위가 크므로 선택 단계**로 두고, 장기적으로 전환을 권장한다.

---

## 2. 현재 구조

| 구분 | 현재 | 비고 |
|------|------|------|
| **상품 테이블** | `category` (text, 단일), `theme` (text, 쉼표/구분자 토큰) | 지역·상품군이 category에 혼재, 테마·기획이 theme에 혼재 |
| **매칭 방식** | `product.category === taxonomy.name`, `parseThemeTokens(product.theme).includes(name)` | 문자열 억지 매칭, taxonomy_type 구분 없음 |
| **관리자 폼** | 카테고리 1개 선택, 테마 다중 선택(이름 토큰) | destination/product_line 구분 없음 |

---

## 3. 권장 방향 비교

### 3.1 Phase 2: 컬럼 확장 (권장 1차)

**추가 컬럼**

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `destination_id` | uuid (FK → product_taxonomies.id, taxonomy_type='destination') | 지역 1개 |
| `product_line_id` | uuid (FK → product_taxonomies.id, taxonomy_type='product_line') | 상품군 1개 |
| `campaigns_json` | jsonb (선택) | 기획 ID 배열 또는 이름 배열. 예: `["uuid1","uuid2"]` 또는 `["마감임박"]` |
| `tags_json` | jsonb (선택) | 태그 이름 배열. 예: `["가족","럭셔리"]` |

- **theme** 유지: 테마는 다중 선택이 많으므로 기존 `theme` 컬럼(토큰 문자열)을 당분간 유지하고, 옵션만 taxonomy_type='theme' 기준으로 제한. 이후 `theme_ids_json` 등으로 이전 검토.
- **장점**: 마이그레이션 단순, 기존 category/theme와 병행 가능, 필터/허브에서 우선 새 컬럼 사용 후 fallback으로 legacy 사용.
- **단점**: theme 다:다는 기존 문자열 유지 또는 별도 jsonb 배열 필요.

### 3.2 Phase 3: 다:다 링크 테이블

**새 테이블**

```sql
create table public.product_taxonomy_links (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  taxonomy_id uuid not null references public.product_taxonomies(id) on delete restrict,
  taxonomy_type text not null, -- destination | theme | product_line | campaign | tag
  sort_order integer,
  created_at timestamptz not null default now(),
  unique (product_id, taxonomy_id)
);
create index idx_product_taxonomy_links_product on product_taxonomy_links(product_id);
create index idx_product_taxonomy_links_type on product_taxonomy_links(taxonomy_type);
```

- **장점**: 축별 다:다 완전 지원, taxonomy 변경 시 링크만 관리하면 됨.
- **단점**: 조회/조인/마이그레이션 복잡도 증가, 관리자 폼·API·필터 전반 수정 필요.

---

## 4. 권장 1차: Phase 2 진행 시 작업 목록

### 4.1 DB migration

- `products` 테이블에 nullable 컬럼 추가:
  - `destination_id uuid references product_taxonomies(id)`
  - `product_line_id uuid references product_taxonomies(id)`
  - `campaigns_json jsonb` (선택)
  - `tags_json jsonb` (선택)
- 기존 `category`, `theme` 컬럼은 **유지** (deprecated 표시만, fallback용).

### 4.2 상품 타입 정의

- `Product` 타입에 선택 필드 추가:
  - `destination_id?: string | null`
  - `product_line_id?: string | null`
  - `campaigns?: string[] | null` (이름 또는 ID)
  - `tags?: string[] | null`
- `category`, `theme`에 `@deprecated` 또는 주석으로 “legacy, 새 필드 우선 사용” 명시.

### 4.3 데이터 마이그레이션 (별도 스크립트/마이그레이션)

- 기존 상품에 대해:
  - `category` 값이 taxonomy 테이블에서 **destination**이면 → `destination_id` 설정.
  - `category` 값이 **product_line**이면 → `product_line_id` 설정.
  - `theme` 토큰 중 **destination** 성격 → destination_id로 이전하고 theme에서는 제거(선택).
  - `theme` 토큰 중 **campaign** 성격 → `campaigns_json`으로 이전 검토.
- migration 후에도 **category/theme는 fallback**으로 유지해, 새 필드가 비어 있으면 기존 로직 사용.

### 4.4 관리자 상품 폼

- **지역**: destination만 선택 (destination_id). 기존 “카테고리”를 “지역”으로 라벨 변경, 옵션은 taxonomy_type='destination'만.
- **테마**: theme만 다중 선택 (기존 theme 문자열 유지 또는 theme_ids_json 도입).
- **상품군**: product_line 단일 선택 (product_line_id).
- **기획**: campaign 다중 선택 → campaigns_json.
- **태그**: 자유 입력 또는 taxonomy tag 선택 → tags_json.

### 4.5 필터 로직

- `applyProductFilters`:
  - **region**: `product.destination_id`가 해당 destination id와 일치하거나, **fallback** `product.category === name`.
  - **theme**: `parseThemeTokens(product.theme).includes(name)` 유지, 옵션은 theme taxonomy만.
  - **product_line**: `product.product_line_id`가 해당 id와 일치하거나, **fallback** `product.category === name`.
- 점진적으로 새 필드 우선, 없으면 legacy 사용.

### 4.6 허브/랜딩 대표 상품 조회

- `/destinations/[slug]`: taxonomy slug로 destination id 조회 후, `product.destination_id = id` 또는 fallback `product.category === name`.
- `/themes/[slug]`: theme name/slug 매칭 후, `product.theme` 토큰 포함 또는 (Phase 3 시) theme 링크 테이블.
- `/product-lines/[slug]` 도입 시: `product.product_line_id` 또는 fallback `product.category === name`.

### 4.7 legacy 제거 (안정화 후)

- 상품 데이터가 새 필드로 충분히 이전된 뒤:
  - `category`, `theme` 컬럼을 nullable로 두거나 제거 검토.
  - `product_taxonomies`의 `type`/`category_type` 제거 검토.
- 코드에서 `category`/`theme` 의존 제거: normalize/serialize/hydrate, API, 관리자 폼.

---

## 5. 수정/영향 파일 요약

| 구분 | 파일 |
|------|------|
| DB | `supabase/migrations/20260319000000_products_taxonomy_axes.sql` (신규) |
| 타입 | `src/types/product.ts` |
| 필터 | `src/lib/productFilters.ts` (applyProductFilters) |
| 상품 조회/정규화 | `src/lib/products.ts`, 상품 API (getProducts 등) |
| 관리자 폼 | `src/components/AdminProductManager.tsx`, 폼 섹션(지역/테마/상품군) |
| 랜딩/허브 | `src/lib/productLanding.ts`, `src/lib/productTaxonomies.ts` (usage count 등) |
| 직렬화/역직렬화 | 상품 저장/로드 시 destination_id, product_line_id, campaigns_json, tags_json 처리 |

---

## 6. 검증 포인트

- [ ] 상품 1개가 destination / theme / product_line / campaign / tag를 명확히 가질 수 있는지
- [ ] 필터 결과가 새 축 기준으로 정확해지는지
- [ ] 랜딩 → 상품 목록 세분화가 더 자연스러운지
- [ ] legacy 문자열 파싱 의존이 줄어드는지 (fallback만 유지)

---

## 7. 이번 PR에서의 1단계 (선택 적용)

- **설계 문서**: 본 문서로 확정.
- **DB migration 1건**: `supabase/migrations/20260319000000_products_taxonomy_axes.sql`
  - `destination_id`, `product_line_id` (nullable, FK → product_taxonomies), `campaigns_json`, `tags_json` 추가.
  - legacy `category`/`theme` 컬럼 유지 및 주석으로 deprecated 안내.
- **Product 타입 확장**: `src/types/product.ts`에 `destination_id`, `product_line_id`, `campaigns`, `tags` 추가. `category`/`theme`에 `@deprecated` 주석.
- **실제 필터/폼/API 전환**: 후속 PR에서 단계적으로 적용 가능 (applyProductFilters에서 새 필드 우선, 관리자 폼 destination/product_line 선택, 데이터 마이그레이션 스크립트 등).

이렇게 하면 스키마와 타입만 먼저 확장해 두고, 이후 데이터 이전·폼·필터·허브를 순차적으로 전환할 수 있다.
