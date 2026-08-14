-- Threads 장기 토큰 저장(환경변수 대체) + 갱신/운영 로그.
-- API(service_role) 경유 전용. site_settings는 anon SELECT가 있어 토큰 저장에 쓰지 않음.

create extension if not exists "pgcrypto";

create table if not exists public.thread_marketing_tokens (
  id text primary key default 'default' check (id = 'default'),
  access_token text not null,
  expires_at timestamptz,
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.thread_marketing_tokens is 'Threads 장기 액세스 토큰. 주간 갱신 크론이 덮어씀. service_role 전용.';

create table if not exists public.thread_marketing_logs (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  status text not null check (status in ('ok', 'error')),
  message text,
  meta jsonb,
  created_at timestamptz not null default now()
);

comment on table public.thread_marketing_logs is 'Threads 마케팅 자동화 상태 로그 (토큰 갱신 등).';

create index if not exists idx_thread_marketing_logs_created
  on public.thread_marketing_logs (created_at desc);

create index if not exists idx_thread_marketing_logs_event_created
  on public.thread_marketing_logs (event, created_at desc);

alter table public.thread_marketing_tokens enable row level security;
alter table public.thread_marketing_logs enable row level security;
-- anon/authenticated 정책을 의도적으로 두지 않음. service_role(supabaseAdmin)만 RLS 우회 접근.
