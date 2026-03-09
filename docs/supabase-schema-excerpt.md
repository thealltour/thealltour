# Supabase 스키마 발췌 (외래키·인덱스·RLS·마이그레이션 목록)

프로젝트 폴더 기준 `supabase/*.sql`, `supabase/migrations/*.sql`, `supabase/schema/*.sql` 을 정리한 요약입니다.  
실제 DB 상태는 Supabase 대시보드에서 확인하는 것이 최종입니다.

---

## 1. 외래키 / 관계 구조

### 1.1 products ↔ destinations / themes / product_lines

**별도 테이블 없음.**  
`destinations`, `themes`, `product_lines` 는 모두 **`public.product_taxonomies`** 한 테이블에서 **행 구분**으로 처리됩니다.

| 구분 | 저장 방식 | 설명 |
|------|------------|------|
| **destination** | FK + 문자열(레거시) | `products.destination_id` → `product_taxonomies(id)` (taxonomy_type='destination'). 레거시: `products.category` (text). |
| **theme** | 문자열(레거시) | 레거시: `products.theme` (text). 신규 축에서는 `product_taxonomies` 의 taxonomy_type='theme' 행과 매칭. |
| **product_line** | FK | `products.product_line_id` → `product_taxonomies(id)` (taxonomy_type='product_line'). |

- **문자열 컬럼:** `products.category`, `products.theme` (레거시, 여전히 사용·fallback).
- **join 테이블:** 없음. 상품–분류는 FK 또는 문자열 매칭.
- **array/json:**  
  - `products.campaigns_json` (jsonb) — 기획/강조 taxonomy id 또는 이름 배열.  
  - `products.tags_json` (jsonb) — 태그 이름 배열.

**정리:**

- `products.destination_id` (uuid, FK → product_taxonomies.id)
- `products.product_line_id` (uuid, FK → product_taxonomies.id)
- `products.category` (text, 레거시)
- `products.theme` (text, 레거시)
- `products.campaigns_json` (jsonb, 선택)
- `products.tags_json` (jsonb, 선택)

`product_taxonomies` 에서 분류 타입은 **`taxonomy_type`** 으로 구분:  
`destination` | `theme` | `product_line` | `campaign` | `tag`.

### 1.2 기타 주요 FK

- `reviews.member_id` → `members(id)`  
- `reviews.eligibility_id` → `review_eligibilities(id)`  
- `reviews.booking_id` → `travel_bookings(id)`  
- `review_reports.review_id` → `reviews(id)`  
- `review_votes.review_id` → `reviews(id)`  
- `product_review_summaries.product_id` → `products(id)` (유일 1:1)  
- `home_curated_sections.setting_id` → `home_curated_settings(id)`  
- `home_curated_section_products.section_id` → `home_curated_sections(id)`  
- `home_curated_section_products.product_id` → `products(id)`  
- `landing_subnodes`: FK 없음. `parent_kind` + `parent_slug` 로 `product_taxonomies.slug` 와 논리적 연결.  
- `product_taxonomies.parent_id` → `product_taxonomies(id)` (계층용).

---

## 2. 인덱스 / unique 제약

### 2.1 products.slug

- **products 테이블에는 `slug` 컬럼이 없습니다.**  
- 상품 상세 URL은 `id` (uuid) 기준 (`/products/[id]`)으로 사용됩니다.  
- 따라서 **products.slug unique 여부는 해당 없음.**

### 2.2 taxonomy 관련 unique

| 대상 | 제약 | 비고 |
|------|------|------|
| `product_taxonomies` | `unique (type, name)` | 테이블 정의 (product_taxonomies.sql) |
| `product_taxonomies` | `idx_product_taxonomies_type_slug_unique` | (type, slug) 유일, slug 비어 있으면 제외 (20260316) |
| `product_taxonomies` | `idx_product_taxonomies_taxonomy_type_slug_unique` | (taxonomy_type, slug) 유일, slug 비어 있으면 제외 (20260318) |
| `landing_subnodes` | `uq_landing_subnodes_parent_slug` | (parent_kind, parent_slug, slug) 유일 |

### 2.3 정렬/조회용 인덱스 (일부)

- **products:**  
  `idx_products_sort_order`, `idx_products_is_active`, `idx_products_created_at`,  
  `idx_products_category`, `idx_products_theme`,  
  `idx_products_destination_id`, `idx_products_product_line_id` (20260319)
- **product_taxonomies:**  
  `idx_product_taxonomies_type`, `idx_product_taxonomies_sort`,  
  `idx_product_taxonomies_hub_visible`, `idx_product_taxonomies_taxonomy_type_hub`,  
  `idx_product_taxonomies_parent_id`
- **reviews:**  
  `idx_reviews_created_at`, `idx_reviews_member_id`, `idx_reviews_status`,  
  `idx_reviews_updated_at`, `idx_reviews_member_status`, `idx_reviews_eligibility_unique`,  
  `idx_reviews_report_count` 등
- **guides:**  
  `idx_guides_is_published`, `idx_guides_sort_order`, `idx_guides_created_at`,  
  `idx_guides_slug` (guides_notion_upgrade.sql)
- **home_curated:**  
  `idx_home_curated_settings_key`, `idx_home_curated_sections_setting`,  
  `idx_home_curated_section_products_section` / `_product` / `_sort` 등
- **analytics_events:**  
  `idx_analytics_events_event_occurred`, `idx_analytics_events_source_occurred`,  
  `idx_analytics_events_taxonomy_occurred`, `idx_analytics_events_query_occurred`

---

## 3. 현재 적용된 migration 파일 목록

**프로젝트 폴더 기준** `supabase/migrations/` 에 있는 SQL 파일 목록입니다.  
(실제 적용 순서는 Supabase 대시보드 또는 `supabase_migrations.schema_migrations` 로 확인해야 합니다.)

**최신순 (파일명 기준):**

```
20260321000000_product_taxonomies_card_meta.sql
20260320000000_product_taxonomies_parent_id.sql
20260319000000_products_taxonomy_axes.sql
20260317000000_landing_subnodes.sql
20260316000000_pr1_hub_landing_taxonomy.sql
20260314100000_review_system_notifications.sql
20260313100000_review_conversion_session_key.sql
20260312100000_review_experiment_events.sql
20260311100000_review_moderation_history.sql
20260310100000_review_moderation_columns.sql
20260309110000_product_review_summaries.sql
20260309100000_review_reminders.sql
20260308190000_normalize_products_rls.sql
20260308220000_review_rewards.sql
20260308210000_review_reports.sql
20260308200000_review_votes.sql
20260308180000_normalize_products_extended_columns.sql
20260308160000_normalize_rls_policies.sql
20260308150000_cleanup_reward_redemption_legacy_table.sql
20260308140000_cleanup_point_ledger_legacy_columns.sql
20260308130000_fix_travel_bookings_inquiry_id.sql
20260308120000_reconcile_reviews_columns.sql
20260308110000_normalize_reward_redemptions.sql
20260308100000_normalize_point_ledger.sql
20260307130000_reviews_draft_fields.sql
20260307120000_review_claim_token.sql
20260307100000_reviews_eligibility_columns.sql
20260305110000_pr1_schema_rls_fix.sql
20260305100000_customer_profiles_and_eligibility.sql
20260304070000_point_earn_requests_step3.sql
20250304000000_points_rewards_v2.sql
```

**루트/스키마용 SQL (migrations 외):**

- `supabase/product_taxonomies.sql` — product_taxonomies 테이블 생성
- `supabase/product_taxonomies_slug_migration.sql` — slug 컬럼 추가
- `supabase/home_curated.sql` — home_curated_* 테이블
- `supabase/home_banners.sql`, `supabase/home_hero_content.sql`
- `supabase/reviews.sql`, `supabase/guides.sql`, `supabase/inquiries.sql`
- `supabase/analytics_events.sql`, `supabase/products_policies.sql`
- `supabase/schema/baseline.sql` — 제안 기준본
- `supabase/schema/optional_recommended_search_keywords.sql` — 선택

---

## 4. RLS 사용 여부

### 4.1 products

| 항목 | 내용 |
|------|------|
| RLS enabled | 예 (`products_policies.sql`, `20260308190000_normalize_products_rls.sql`) |
| 정책 | `Allow public read products` (select anon) |
| | `Allow public insert products` (insert anon) |
| | `Allow public update products` (update anon) |
| | `Allow public delete products` (delete anon) |

### 4.2 reviews

| 항목 | 내용 |
|------|------|
| RLS enabled | 예 (`reviews.sql`, baseline) |
| 정책 | `Allow public read reviews` (select anon) |
| | `Allow public insert reviews` (insert anon) |
| | `Allow public update reviews` (update anon) |

(후속 migration에서 정책명이 통일되었을 수 있음. 실제는 대시보드에서 확인.)

### 4.3 guides

| 항목 | 내용 |
|------|------|
| RLS enabled | 예 (`guides.sql`, baseline) |
| 정책 | `guides_select_anon`, `guides_insert_anon`, `guides_update_anon`, `guides_delete_anon` (anon 전부 허용) |

### 4.4 홈 편성 관련 테이블

- **home_curated_settings**  
  - baseline에는 RLS 정의 없음.  
  - 별도 migration에서 RLS를 켜지 않았다면 **RLS 비활성** 상태일 수 있음.
- **home_curated_sections**  
  - 동일. RLS 없음으로 정의된 상태.
- **home_curated_section_products**  
  - 동일.
- **home_banners**  
  - RLS enabled (baseline).  
  - 정책: `home_banners_select_anon`, `home_banners_insert_anon`, `home_banners_update_anon`, `home_banners_delete_anon`.
- **home_hero_content**  
  - RLS enabled (`home_hero_content.sql`).  
  - 정책: `home_hero_content_select_anon`, `home_hero_content_all_service` (또는 유사 anon all).

### 4.5 analytics_events

| 항목 | 내용 |
|------|------|
| RLS enabled | 예 (`analytics_events.sql`) |
| 정책 | `analytics_events_insert_anon` (insert anon만 허용, select는 별도 정책 없음) |

---

## 5. sample row (구조 예시)

실제 데이터는 Supabase Table Editor에서 확인하는 것이 정확합니다.  
아래는 **컬럼 구조 이해용** 예시 형태입니다. (개인정보/민감정보 제외.)

### 5.1 products (예시 1~2개 분량 필드만)

```json
{
  "id": "uuid",
  "title": "일본 오사카 골프 3박 4일",
  "description": "…",
  "image_url": "https://…",
  "category": "해외 골프 투어",
  "theme": "제철 인기",
  "destination_id": "uuid-of-product_taxonomies-destination-row",
  "product_line_id": "uuid-of-product_taxonomies-product_line-row",
  "price": 1890000,
  "is_active": true,
  "sort_order": 10
}
```

- `destination_id` / `product_line_id` 가 있으면 해당 FK로 분류.  
- 비어 있으면 `category` / `theme` 문자열로 fallback.

### 5.2 destinations (product_taxonomies 중 taxonomy_type='destination')

```json
{
  "id": "uuid",
  "type": "category",
  "taxonomy_type": "destination",
  "name": "일본",
  "slug": "japan",
  "is_active": true,
  "is_hub_visible": true,
  "is_landing_enabled": true,
  "sort_order": 1,
  "parent_id": null
}
```

- `parent_id` 가 있으면 상위 destination(대분류) under 같은 taxonomy_type.

### 5.3 themes (product_taxonomies 중 taxonomy_type='theme')

```json
{
  "id": "uuid",
  "type": "theme",
  "taxonomy_type": "theme",
  "name": "골프 여행",
  "slug": "golf-travel",
  "is_active": true,
  "is_hub_visible": true,
  "is_landing_enabled": true,
  "sort_order": 1
}
```

---

**문서 기준:** 프로젝트 내 `supabase/` 및 `supabase/migrations/` 실제 파일 기준으로 작성.  
**실제 DB와 차이가 있으면** Supabase 대시보드(Table Editor, SQL Editor, Policies)를 우선하세요.
