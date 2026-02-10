alter table public.products add column if not exists is_active boolean not null default true;
alter table public.products add column if not exists sort_order integer;
alter table public.products add column if not exists itinerary text;
alter table public.products add column if not exists inclusions text;

alter table public.products alter column title set not null;
alter table public.products alter column description set not null;
alter table public.products alter column image_url set not null;
alter table public.products alter column category set not null;

create index if not exists idx_products_sort_order on public.products (sort_order);
create index if not exists idx_products_is_active on public.products (is_active);
