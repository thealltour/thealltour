-- 랜딩 → quote funnel 분석용 컬럼 (source_path 키, landing_slug 집계)
alter table public.analytics_events
  add column if not exists source_path text;

alter table public.analytics_events
  add column if not exists landing_slug text;

alter table public.analytics_events
  add column if not exists template_type text;

alter table public.analytics_events
  add column if not exists quote_category text;

comment on column public.analytics_events.source_path is '유입 경로 키 (예: /recommended/my-slug). 랜딩→quote funnel 필수.';

comment on column public.analytics_events.landing_slug is '랜딩 slug (source_path에서 파생 가능, 집계용).';

comment on column public.analytics_events.template_type is '랜딩 template_type (예: destination_consulting).';

comment on column public.analytics_events.quote_category is '견적 카테고리 (quote_category 쿼리/폼).';

create index if not exists idx_analytics_events_source_path_occurred
  on public.analytics_events (source_path, occurred_at desc)
  where source_path is not null;

create index if not exists idx_analytics_events_landing_slug_occurred
  on public.analytics_events (landing_slug, occurred_at desc)
  where landing_slug is not null;

create index if not exists idx_analytics_events_event_landing_occurred
  on public.analytics_events (event_name, landing_slug, occurred_at desc)
  where landing_slug is not null;
