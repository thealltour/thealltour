create extension if not exists "pgcrypto";

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  author_name text not null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_reviews_created_at on public.reviews(created_at desc);
create index if not exists idx_reviews_member_id on public.reviews(member_id);

alter table public.reviews enable row level security;

drop policy if exists "Allow public read reviews" on public.reviews;
create policy "Allow public read reviews"
on public.reviews
for select
to anon
using (true);

drop policy if exists "Allow public insert reviews" on public.reviews;
create policy "Allow public insert reviews"
on public.reviews
for insert
to anon
with check (true);
