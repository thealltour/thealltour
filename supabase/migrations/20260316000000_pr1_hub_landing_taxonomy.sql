-- PR-1: 1depth 허브 랜딩 연동을 위한 분류/랜딩 메타 확장
-- product_taxonomies: category_type, is_hub_visible, is_landing_enabled 추가 및 slug backfill

-- 1) 새 컬럼 추가 (이미 있으면 스킵)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'category_type') then
    alter table public.product_taxonomies add column category_type text default 'other';
    comment on column public.product_taxonomies.category_type is 'category 타입일 때만 사용. destination | product_line | highlight | other';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'is_hub_visible') then
    alter table public.product_taxonomies add column is_hub_visible boolean not null default true;
    comment on column public.product_taxonomies.is_hub_visible is '허브 메뉴(1depth) 노출 여부';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'is_landing_enabled') then
    alter table public.product_taxonomies add column is_landing_enabled boolean not null default false;
    comment on column public.product_taxonomies.is_landing_enabled is '상세 랜딩 페이지 공개 여부';
  end if;
end $$;

-- 2) slug backfill: 비어 있는 slug를 name 기반 URL-safe 값으로 채움 (영문/숫자/공백만 처리, 한글은 비우고 수동 입력 권장)
create or replace function public.slug_from_name(name_val text)
returns text
language plpgsql immutable as $$
declare
  s text;
begin
  s := lower(trim(name_val));
  s := regexp_replace(s, '\s+', '-', 'g');
  s := regexp_replace(s, '[^a-z0-9\-]', '', 'g');
  s := regexp_replace(s, '-+', '-', 'g');
  s := trim(both '-' from s);
  return nullif(s, '');
end $$;

update public.product_taxonomies
set slug = public.slug_from_name(name)
where (slug is null or trim(slug) = '')
  and name is not null and trim(name) != ''
  and public.slug_from_name(name) is not null;

-- 3) type+slug 중복 방지: 동일 type 내 slug 유일 (비어 있지 않은 slug만)
drop index if exists idx_product_taxonomies_type_slug_unique;
create unique index idx_product_taxonomies_type_slug_unique
  on public.product_taxonomies (type, slug)
  where slug is not null and trim(slug) != '';

-- 4) 허브 조회용 인덱스
create index if not exists idx_product_taxonomies_hub_visible
  on public.product_taxonomies (type, is_active, is_hub_visible)
  where is_active = true and is_hub_visible = true;

-- 5) home_curated_sections: 허브/랜딩용 slug, landing_enabled
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'home_curated_sections' and column_name = 'slug') then
    alter table public.home_curated_sections add column slug text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'home_curated_sections' and column_name = 'landing_enabled') then
    alter table public.home_curated_sections add column landing_enabled boolean not null default false;
  end if;
end $$;
