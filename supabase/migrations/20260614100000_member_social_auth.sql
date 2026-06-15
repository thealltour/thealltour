-- 소셜 로그인: members 확장 + provider 연결 테이블

alter table public.members
  alter column password_hash drop not null,
  alter column password_salt drop not null,
  alter column phone drop not null,
  alter column email drop not null,
  alter column birth_date drop not null,
  alter column gender drop not null;

alter table public.members
  add column if not exists signup_method text not null default 'local'
    check (signup_method in ('local', 'social', 'mixed')),
  add column if not exists profile_completed_at timestamptz;

create unique index if not exists members_email_unique_idx
  on public.members (lower(email))
  where email is not null and trim(email) <> '';

create table if not exists public.member_auth_providers (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  provider text not null check (provider in ('google', 'kakao', 'naver')),
  provider_user_id text not null,
  email text,
  display_name text,
  avatar_url text,
  raw_profile jsonb,
  linked_at timestamptz not null default now(),
  last_login_at timestamptz,
  unique (provider, provider_user_id),
  unique (member_id, provider)
);

create index if not exists member_auth_providers_member_id_idx
  on public.member_auth_providers (member_id);

create table if not exists public.member_auth_pending_links (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('google', 'kakao', 'naver')),
  provider_user_id text not null,
  provider_email text,
  provider_profile jsonb not null,
  existing_member_id uuid not null references public.members(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists member_auth_pending_links_expires_idx
  on public.member_auth_pending_links (expires_at);

alter table public.member_auth_providers enable row level security;
alter table public.member_auth_pending_links enable row level security;

-- 서버(supabaseAdmin) 전용 — anon/authenticated 정책 없음
