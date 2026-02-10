create extension if not exists "pgcrypto";

create table if not exists public.home_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text not null,
  mobile_image_url text,
  link_url text,
  sort_order integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_home_banners_sort_order on public.home_banners(sort_order);
create index if not exists idx_home_banners_is_active on public.home_banners(is_active);
create index if not exists idx_home_banners_created_at on public.home_banners(created_at desc);

alter table public.home_banners enable row level security;

drop policy if exists "home_banners_select_anon" on public.home_banners;
create policy "home_banners_select_anon"
on public.home_banners
for select
to anon
using (true);

drop policy if exists "home_banners_insert_anon" on public.home_banners;
create policy "home_banners_insert_anon"
on public.home_banners
for insert
to anon
with check (true);

drop policy if exists "home_banners_update_anon" on public.home_banners;
create policy "home_banners_update_anon"
on public.home_banners
for update
to anon
using (true)
with check (true);

drop policy if exists "home_banners_delete_anon" on public.home_banners;
create policy "home_banners_delete_anon"
on public.home_banners
for delete
to anon
using (true);
