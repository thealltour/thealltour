-- DEPRECATED: 메인 추천은 home_curated 구조로 이전됨. 신규 설치 시 사용하지 말 것.
-- 기존 DB에 이미 is_featured_home 컬럼이 있을 수 있음 (drop 하지 않음).
-- alter table public.products
-- add column if not exists is_featured_home boolean not null default false;

-- create index if not exists idx_products_featured_home
-- on public.products(is_featured_home);
