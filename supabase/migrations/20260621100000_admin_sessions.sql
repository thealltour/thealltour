-- 관리자 PWA 장기 세션 (7일 미접속 시 만료, 기기별 수동 해제)
create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_key text not null,
  device_label text,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz null
);

create index if not exists admin_sessions_admin_user_key_idx
  on public.admin_sessions (admin_user_key);

create index if not exists admin_sessions_active_last_seen_idx
  on public.admin_sessions (last_seen_at)
  where revoked_at is null;

alter table public.admin_sessions enable row level security;

revoke all on public.admin_sessions from anon, authenticated;

comment on table public.admin_sessions is '관리자 콘솔/PWA 로그인 세션. last_seen_at 기준 미접속 자동 만료·revoked_at 수동 해제.';
