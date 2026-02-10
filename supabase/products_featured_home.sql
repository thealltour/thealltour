alter table public.products
add column if not exists is_featured_home boolean not null default false;

create index if not exists idx_products_featured_home
on public.products(is_featured_home);
