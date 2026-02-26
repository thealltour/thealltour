create extension if not exists "pgcrypto";

create table if not exists public.guides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  thumbnail_url text,
  landing_url text,
  is_published boolean not null default true,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_guides_is_published on public.guides(is_published);
create index if not exists idx_guides_sort_order on public.guides(sort_order);
create index if not exists idx_guides_created_at on public.guides(created_at desc);

create or replace function public.set_guides_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_guides_updated_at on public.guides;
create trigger trg_guides_updated_at
before update on public.guides
for each row
execute function public.set_guides_updated_at();

alter table public.guides enable row level security;

drop policy if exists "guides_select_anon" on public.guides;
create policy "guides_select_anon"
on public.guides
for select
to anon
using (true);

drop policy if exists "guides_insert_anon" on public.guides;
create policy "guides_insert_anon"
on public.guides
for insert
to anon
with check (true);

drop policy if exists "guides_update_anon" on public.guides;
create policy "guides_update_anon"
on public.guides
for update
to anon
using (true)
with check (true);

drop policy if exists "guides_delete_anon" on public.guides;
create policy "guides_delete_anon"
on public.guides
for delete
to anon
using (true);

