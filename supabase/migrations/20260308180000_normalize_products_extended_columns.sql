-- =============================================================================
-- Phase 2 PR10-B2: public.products 확장 컬럼 정합성 보정
-- =============================================================================
--
-- 목적:
--   앱이 사용하는 products 의 확장 컬럼(항공편, SEO, 관리자/카드, overview/itinerary)을
--   add column if not exists 로만 보강합니다. destructive 변경 없음.
--
-- 왜 확장 컬럼만 다루는가:
--   PR10-B1에서 핵심 컬럼(theme, images_json, travel_fields, min_departure_people 등)을
--   반영했습니다. 이번 PR은 항공편·SEO·관리자 필드·overview/json 일정 컬럼만 추가합니다.
--
-- 이번 PR 범위 밖:
--   - trust 컬럼 (집계/캐시 성격, 별도 검토)
--   - products RLS 정책 (정책 통일은 별도 migration)
--   - 레거시 컬럼(name, content, image, type, duration_days) 제거 또는 변경 금지
--   - overview_cover_url 은 레거시 호환으로 유지, 제거하지 않음
--
-- ⚠️ 실행 전 권장:
--   스테이징/개발 환경에서 먼저 적용·검증 후 운영에 반영하세요.
--   public.products 테이블은 baseline 또는 PR10-B1 migration 적용으로 존재해야 합니다.
--
-- =============================================================================

do $$
declare
  products_exists boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'products'
  ) into products_exists;

  if not products_exists then
    raise exception 'public.products 테이블이 없습니다. baseline.sql 또는 products_safe_upgrade.sql 적용 후 이 migration을 실행하세요.';
  end if;

  -- 항공편
  alter table public.products add column if not exists departure_from_airport text;
  alter table public.products add column if not exists departure_from_date text;
  alter table public.products add column if not exists departure_from_time text;
  alter table public.products add column if not exists departure_to_airport text;
  alter table public.products add column if not exists departure_to_date text;
  alter table public.products add column if not exists departure_to_time text;
  alter table public.products add column if not exists departure_flight_name text;
  alter table public.products add column if not exists departure_baggage_limit text;
  alter table public.products add column if not exists arrival_from_airport text;
  alter table public.products add column if not exists arrival_from_date text;
  alter table public.products add column if not exists arrival_from_time text;
  alter table public.products add column if not exists arrival_to_airport text;
  alter table public.products add column if not exists arrival_to_date text;
  alter table public.products add column if not exists arrival_to_time text;
  alter table public.products add column if not exists arrival_flight_name text;
  alter table public.products add column if not exists arrival_baggage_limit text;

  -- SEO
  alter table public.products add column if not exists meta_title text;
  alter table public.products add column if not exists meta_description text;

  -- 관리자/카드
  alter table public.products add column if not exists status text;
  alter table public.products add column if not exists options jsonb;
  alter table public.products add column if not exists fuel_included boolean;
  alter table public.products add column if not exists price_meta text;
  alter table public.products add column if not exists meta_info text;
  alter table public.products add column if not exists one_liner text;

  -- overview / itinerary
  alter table public.products add column if not exists overview_json jsonb;
  alter table public.products add column if not exists overview_accommodation text;
  alter table public.products add column if not exists overview_region text;
  alter table public.products add column if not exists overview_duration text;
  alter table public.products add column if not exists itinerary_days_json jsonb;
  alter table public.products add column if not exists itinerary_media_json jsonb;
  alter table public.products add column if not exists itinerary_v2_json jsonb;
  alter table public.products add column if not exists theme_chart_json jsonb;
  alter table public.products add column if not exists overview_cover_url text;
end $$;

-- 최소 인덱스 (필요 시에만)
create index if not exists idx_products_status on public.products(status) where status is not null;
