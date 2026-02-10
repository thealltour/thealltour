create extension if not exists "pgcrypto";

create table if not exists public.product_taxonomies (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('category', 'theme')),
  name text not null,
  is_active boolean not null default true,
  sort_order integer,
  created_at timestamptz not null default now(),
  unique (type, name)
);

create index if not exists idx_product_taxonomies_type on public.product_taxonomies(type);
create index if not exists idx_product_taxonomies_sort on public.product_taxonomies(sort_order);

alter table public.product_taxonomies enable row level security;

drop policy if exists "taxonomies_select_anon" on public.product_taxonomies;
create policy "taxonomies_select_anon"
on public.product_taxonomies
for select
to anon
using (true);

drop policy if exists "taxonomies_insert_anon" on public.product_taxonomies;
create policy "taxonomies_insert_anon"
on public.product_taxonomies
for insert
to anon
with check (true);

drop policy if exists "taxonomies_update_anon" on public.product_taxonomies;
create policy "taxonomies_update_anon"
on public.product_taxonomies
for update
to anon
using (true)
with check (true);

drop policy if exists "taxonomies_delete_anon" on public.product_taxonomies;
create policy "taxonomies_delete_anon"
on public.product_taxonomies
for delete
to anon
using (true);

insert into public.product_taxonomies (type, name, is_active, sort_order)
values
  ('category', '지역별', true, 1),
  ('category', '액티비티', true, 2),
  ('category', '제철여행지', true, 3),
  ('theme', '제철', true, 1),
  ('theme', '인기', true, 2),
  ('theme', '마감임박', true, 3)
on conflict (type, name) do nothing;
