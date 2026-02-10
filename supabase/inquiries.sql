create extension if not exists "pgcrypto";

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  content text not null,
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.inquiries enable row level security;

drop policy if exists "Allow public insert inquiries" on public.inquiries;
create policy "Allow public insert inquiries"
on public.inquiries
for insert
to anon
with check (true);

drop policy if exists "Allow public read inquiries" on public.inquiries;
create policy "Allow public read inquiries"
on public.inquiries
for select
to anon
using (true);

drop policy if exists "Allow public update inquiries" on public.inquiries;
create policy "Allow public update inquiries"
on public.inquiries
for update
to anon
using (true)
with check (true);
