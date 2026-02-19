alter table public.products
add column if not exists product_source_url text;

comment on column public.products.product_source_url is '관리자 전용 상품 원본 주소';
