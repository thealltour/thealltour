-- PR29: 리뷰 시스템 운영 알림 저장 테이블.

create table if not exists public.review_system_notifications (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  category text not null,
  severity text not null,
  status text not null default 'unread',
  product_id text,
  review_id text,
  title text not null,
  message text not null,
  dedupe_key text,
  source_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_review_system_notifications_status
  on public.review_system_notifications(status);
create index if not exists idx_review_system_notifications_created
  on public.review_system_notifications(created_at desc);
create index if not exists idx_review_system_notifications_dedupe
  on public.review_system_notifications(dedupe_key)
  where dedupe_key is not null;
create index if not exists idx_review_system_notifications_product
  on public.review_system_notifications(product_id)
  where product_id is not null;

comment on table public.review_system_notifications is 'PR29: 리뷰 이상/검토/신고/전환/인사이트 등 운영 알림';
