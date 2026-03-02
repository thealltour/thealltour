# Phase 4: Supabase 최적화

## 적용 완료

### 1. site_settings 캐싱

**파일**: `src/lib/siteSettings.ts`

- `unstable_cache` 적용 (5분, tag: `site-settings`)
- 관리자 PATCH 시 `revalidateTag("site-settings")` 호출
- **효과**: products, about, product-detail 등 페이지 로드 시 DB 호출 감소

### 2. adminCounts count 쿼리

**파일**: `src/lib/adminCounts.ts`

- `select("*", { count: "exact", head: true })` → `select("id", { count: "exact", head: true })`
- **효과**: count 전용 쿼리에서 최소 컬럼만 지정 (서버 부담 감소)

### 3. home_banners select

**파일**: `src/lib/homeBanners.ts`

- `select("*")` → `select("id, title, image_url, mobile_image_url, link_url, sort_order, is_active, created_at")`
- **효과**: 필요한 컬럼만 조회, 전송량 감소

---

## 기존 캐시 상태 (유지)

| 데이터 | revalidate | tags |
|--------|------------|------|
| products | 60s | products |
| products (featured) | 60s | products |
| product (by id) | 120s | products |
| home_banners | 120s | home-banners |
| guides | 3h | guides:list |
| guide content | 300s | guide:{slug}, guides:list |
| product_taxonomies | 300s | product-taxonomies |
| product_terms_templates | 60s | products |
| **site_settings** | **300s** | **site-settings** |

---

## 추후 검토

### 1. adminCounts 캐싱

- 대시보드 KPI: 12개 쿼리 병렬 실행
- `unstable_cache` 60s 적용 시 관리자 새로고침 시 DB 호출 감소

### 2. inquiries 목록

- `select("*", { count: "exact" })` — 전체 행 조회 시
- 페이지네이션 + `limit`/`offset` 적용 검토

### 3. products select

- 목록용: `id, title, category, theme, image_url, images_json, price, ...` 등 필요한 컬럼만
- 상품 타입이 많아 변경 시 주의 필요

### 4. 인덱스

**추가**: `supabase/inquiries_indexes_for_counts.sql`

- `idx_inquiries_is_completed_created_at`: 관리자 대시보드 count 쿼리용
- `idx_inquiries_created_at`: 날짜별 집계용

**기존**:
- `guides`: `slug`, `notion_page_id` (guides_notion_upgrade.sql)
- `products`: `is_active`, `sort_order`, `created_at` 점검 권장

### 5. Storage

- 리뷰 이미지: `cacheControl: "3600"` 적용됨
- 상품 이미지: WebP 업로드 정책 유지

---

## Supabase Dashboard 확인

- **Usage**: DB 요청 수, Storage 대역폭
- **Logs → API**: 느린 쿼리, 응답 시간 스파이크
