alter table public.products
add column if not exists category text not null default '여행상품';

alter table public.products
add column if not exists theme text;

update public.products
set category = '여행상품'
where category is null or trim(category) = '';

create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_theme on public.products(theme);
