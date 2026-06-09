-- 하위 관리자 계정 (총괄 admin은 env ADMIN_ID 고정)
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text,
  password_hash text not null,
  password_salt text not null,
  role_preset text not null default 'custom',
  permissions text[] not null default '{}',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_users_username_idx on public.admin_users (username);
create index if not exists admin_users_is_active_idx on public.admin_users (is_active);

alter table public.admin_users enable row level security;

-- service role만 접근 (supabaseAdmin)
revoke all on public.admin_users from anon, authenticated;
