create extension if not exists "pgcrypto";

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  image_url text not null,
  category text not null default '여행상품',
  price integer,
  duration text,
  itinerary text,
  inclusions text,
  is_active boolean not null default true,
  is_featured_home boolean not null default false,
  sort_order integer,
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists title text;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists category text;
alter table public.products add column if not exists price integer;
alter table public.products add column if not exists duration text;
alter table public.products add column if not exists itinerary text;
alter table public.products add column if not exists inclusions text;
alter table public.products add column if not exists is_active boolean not null default true;
alter table public.products add column if not exists is_featured_home boolean not null default false;
alter table public.products add column if not exists sort_order integer;
alter table public.products add column if not exists created_at timestamptz not null default now();

update public.products
set category = coalesce(nullif(category, ''), '여행상품')
where category is null or category = '';

alter table public.products alter column title set not null;
alter table public.products alter column description set not null;
alter table public.products alter column image_url set not null;
alter table public.products alter column category set not null;
alter table public.products alter column category set default '여행상품';

create index if not exists idx_products_sort_order on public.products(sort_order);
create index if not exists idx_products_is_active on public.products(is_active);
create index if not exists idx_products_featured_home on public.products(is_featured_home);
create index if not exists idx_products_created_at on public.products(created_at desc);
