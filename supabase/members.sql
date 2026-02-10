create extension if not exists "pgcrypto";

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  name text not null,
  password_hash text not null,
  password_salt text not null,
  phone text not null,
  email text not null,
  birth_date date not null,
  gender text not null check (gender in ('male', 'female', 'other')),
  agree_terms boolean not null default false,
  agree_privacy boolean not null default false,
  agree_email boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.members enable row level security;

drop policy if exists "Allow public insert members" on public.members;
create policy "Allow public insert members"
on public.members
for insert
to anon
with check (true);

drop policy if exists "Allow public check username" on public.members;
create policy "Allow public check username"
on public.members
for select
to anon
using (true);
