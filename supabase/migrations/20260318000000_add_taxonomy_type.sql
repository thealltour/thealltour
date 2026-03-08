-- PR-TAX-1: taxonomy_type 도입. type/category_type 조합을 점진 대체.
-- 기존 type, category_type 컬럼은 유지(deprecated). taxonomy_type만 새로 추가 및 backfill.

-- 1) taxonomy_type 컬럼 추가
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'taxonomy_type'
  ) then
    alter table public.product_taxonomies add column taxonomy_type text;
    comment on column public.product_taxonomies.taxonomy_type is '분류 축: destination | theme | product_line | campaign | tag. type/category_type 대체용.';
  end if;
end $$;

-- 2) backfill: type + category_type -> taxonomy_type
-- type='category', (category_type IS NULL OR category_type='destination') -> 'destination'
update public.product_taxonomies
set taxonomy_type = 'destination'
where type = 'category'
  and (category_type is null or category_type = 'destination')
  and (taxonomy_type is null or taxonomy_type = '');

-- type='category', category_type='product_line' -> 'product_line'
update public.product_taxonomies
set taxonomy_type = 'product_line'
where type = 'category'
  and category_type = 'product_line'
  and (taxonomy_type is null or taxonomy_type = '');

-- type='category', category_type IN ('highlight','other') -> 'campaign'
update public.product_taxonomies
set taxonomy_type = 'campaign'
where type = 'category'
  and category_type in ('highlight', 'other')
  and (taxonomy_type is null or taxonomy_type = '');

-- type='theme' -> 'theme'
update public.product_taxonomies
set taxonomy_type = 'theme'
where type = 'theme'
  and (taxonomy_type is null or taxonomy_type = '');

-- 남는 category 행(위 조건에 안 걸린 것) 기본값 destination
update public.product_taxonomies
set taxonomy_type = 'destination'
where type = 'category'
  and (taxonomy_type is null or taxonomy_type = '');

-- 3) NOT NULL + default
alter table public.product_taxonomies
  alter column taxonomy_type set default 'destination';

update public.product_taxonomies
set taxonomy_type = coalesce(nullif(trim(taxonomy_type), ''), 'destination')
where taxonomy_type is null or trim(taxonomy_type) = '';

alter table public.product_taxonomies
  alter column taxonomy_type set not null;

-- 4) 허브 조회용 인덱스: taxonomy_type 기준 (기존 type 기준 인덱스와 병행)
create index if not exists idx_product_taxonomies_taxonomy_type_hub
  on public.product_taxonomies (taxonomy_type, is_active, is_hub_visible)
  where is_active = true and is_hub_visible = true;

-- 5) (taxonomy_type, slug) 유일: 타입별 slug 중복 방지. slug 비어 있으면 제외.
drop index if exists idx_product_taxonomies_taxonomy_type_slug_unique;
create unique index idx_product_taxonomies_taxonomy_type_slug_unique
  on public.product_taxonomies (taxonomy_type, slug)
  where slug is not null and trim(slug) != '';
