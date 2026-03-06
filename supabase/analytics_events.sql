-- Analytics events: 헤더/검색/CTA 계측 이벤트 적재용
-- RLS: anon insert 허용 (API 경유만 사용 권장)

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  source text not null,
  page_path text,
  device_type text,
  taxonomy_type text,
  taxonomy_id text,
  taxonomy_slug text,
  taxonomy_name text,
  section text,
  label text,
  href text,
  position integer,
  query text,
  result_count integer,
  product_id text,
  metadata jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.analytics_events is '헤더/검색/CTA 계측 이벤트. fire-and-forget 적재용.';

create index if not exists idx_analytics_events_event_occurred
  on public.analytics_events (event_name, occurred_at desc);

create index if not exists idx_analytics_events_source_occurred
  on public.analytics_events (source, occurred_at desc);

create index if not exists idx_analytics_events_taxonomy_occurred
  on public.analytics_events (taxonomy_type, taxonomy_slug, occurred_at desc)
  where taxonomy_type is not null and taxonomy_slug is not null;

create index if not exists idx_analytics_events_query_occurred
  on public.analytics_events (query, occurred_at desc)
  where query is not null;

alter table public.analytics_events enable row level security;

drop policy if exists "analytics_events_insert_anon" on public.analytics_events;
create policy "analytics_events_insert_anon"
  on public.analytics_events
  for insert
  to anon
  with check (true);

-- select는 서버/관리자만 사용할 수 있도록 제한 가능 (필요 시 service_role 또는 authenticated 정책 추가)
