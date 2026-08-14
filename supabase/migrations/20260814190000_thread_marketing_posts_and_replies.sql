-- 스레드 마케팅 게시 이력 + 키워드 댓글 자동 답글 중복 방지.
-- API(service_role) 경유 전용.

create extension if not exists "pgcrypto";

create table if not exists public.thread_marketing_posts (
  id uuid primary key default gen_random_uuid(),
  media_id text not null unique,
  product_id text not null,
  target_keyword text not null,
  permalink text,
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.thread_marketing_posts is 'Threads 마케팅 게시 이력. 키워드 댓글 자동 답글 크론이 조회.';

create index if not exists idx_thread_marketing_posts_active_published
  on public.thread_marketing_posts (is_active, published_at desc)
  where target_keyword <> '';

create table if not exists public.thread_marketing_replies (
  id uuid primary key default gen_random_uuid(),
  post_id text not null,
  comment_id text not null unique,
  user_handle text,
  replied_at timestamptz not null default now()
);

comment on table public.thread_marketing_replies is 'Threads 키워드 댓글 자동 답글 이력. comment_id 기준 중복 방지.';

create index if not exists idx_thread_marketing_replies_post_id
  on public.thread_marketing_replies (post_id);

alter table public.thread_marketing_posts enable row level security;
alter table public.thread_marketing_replies enable row level security;
-- anon/authenticated 정책을 의도적으로 두지 않음. service_role(supabaseAdmin)만 RLS 우회 접근.
