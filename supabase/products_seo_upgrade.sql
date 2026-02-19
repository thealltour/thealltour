alter table public.products
add column if not exists meta_title text;

alter table public.products
add column if not exists meta_description text;

comment on column public.products.meta_title is '검색엔진용 상품 메타 타이틀';
comment on column public.products.meta_description is '검색엔진용 상품 메타 설명';
