create extension if not exists "pgcrypto";

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  is_published boolean not null default true,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notices_is_published on public.notices(is_published);
create index if not exists idx_notices_sort_order on public.notices(sort_order);
create index if not exists idx_notices_created_at on public.notices(created_at desc);

create or replace function public.set_notices_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_notices_updated_at on public.notices;
create trigger trg_notices_updated_at
before update on public.notices
for each row
execute function public.set_notices_updated_at();

alter table public.notices enable row level security;

drop policy if exists "notices_select_anon" on public.notices;
create policy "notices_select_anon"
on public.notices
for select
to anon
using (true);

drop policy if exists "notices_insert_anon" on public.notices;
create policy "notices_insert_anon"
on public.notices
for insert
to anon
with check (true);

drop policy if exists "notices_update_anon" on public.notices;
create policy "notices_update_anon"
on public.notices
for update
to anon
using (true)
with check (true);

drop policy if exists "notices_delete_anon" on public.notices;
create policy "notices_delete_anon"
on public.notices
for delete
to anon
using (true);
