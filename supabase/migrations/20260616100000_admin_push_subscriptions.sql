-- Web Push 구독 (관리자 PWA OS 알림)
create table if not exists public.admin_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  admin_user_key text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_push_subscriptions_admin_user_key_idx
  on public.admin_push_subscriptions (admin_user_key);

alter table public.admin_push_subscriptions enable row level security;

revoke all on public.admin_push_subscriptions from anon, authenticated;
