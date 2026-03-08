-- =============================================================================
-- Phase 2 PR10-B1: public.products 핵심 컬럼 정합성 보정
-- =============================================================================
--
-- 목적:
--   앱이 핵심적으로 사용하는데 baseline에는 없는 products 컬럼을
--   add column if not exists 로만 보강합니다. destructive 변경 없음.
--
-- 왜 products 전체를 한 번에 다루지 않는가:
--   overview_json, itinerary_v2_json, flight 컬럼, SEO(meta_title/meta_description),
--   admin 확장(status, options, fuel_included 등)은 컬럼 수가 많고 의존 관계가 있어
--   별도 migration(PR10-B2 등)으로 분리합니다. 이번 PR은 "핵심 컬럼"만 다룹니다.
--
-- 확장 컬럼 / 정책:
--   overview_cover_url, trust, status, options, meta_title, meta_description,
--   departure_* / arrival_* 항공편 컬럼, itinerary_days_json, itinerary_media_json,
--   itinerary_v2_json, theme_chart_json, overview_accommodation/region/duration,
--   one_liner, price_meta, meta_info, products RLS 정책 — 모두 후속 PR로 분리.
--
-- ⚠️ 실행 전 권장:
--   스테이징/개발 환경에서 먼저 적용·검증 후 운영에 반영하세요.
--   public.products 테이블은 baseline.sql 또는 products_safe_upgrade.sql 적용으로
--   이미 존재해야 합니다.
--
-- =============================================================================

do $$
declare
  products_exists boolean;
  has_image_url boolean;
begin
  -- 1) public.products 테이블 존재 여부 확인
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'products'
  ) into products_exists;

  if not products_exists then
    raise exception 'public.products 테이블이 없습니다. baseline.sql 또는 products_safe_upgrade.sql 적용 후 이 migration을 실행하세요.';
  end if;

  -- 2) 핵심 컬럼 add column if not exists
  alter table public.products add column if not exists theme text;
  alter table public.products add column if not exists images_json jsonb;
  alter table public.products add column if not exists point_benefits text;
  alter table public.products add column if not exists point_tourism text;
  alter table public.products add column if not exists point_guide text;
  alter table public.products add column if not exists meeting_info text;
  alter table public.products add column if not exists travel_insurance text;
  alter table public.products add column if not exists included_items text;
  alter table public.products add column if not exists excluded_items text;
  alter table public.products add column if not exists detailed_schedule text;
  alter table public.products add column if not exists optional_tours text;
  alter table public.products add column if not exists terms_and_notes text;
  alter table public.products add column if not exists min_departure_people integer;
  alter table public.products add column if not exists product_source_url text;

  -- 3) images_json 보수적 backfill (선택)
  --    조건: images_json is null 이고 image_url 컬럼이 존재하며 image_url is not null
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'image_url'
  ) into has_image_url;

  if has_image_url then
    update public.products
    set images_json = jsonb_build_array(btrim(image_url))
    where images_json is null
      and image_url is not null
      and btrim(image_url) <> '';
  end if;
end $$;

-- 4) 필수 최소 인덱스 (create index if not exists)
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_theme on public.products(theme) where theme is not null;
