-- STEP 3-9: manual publication performance snapshots (read-only feedback loop).
-- Separate from social_performance_snapshots — no fake ExternalPublication / social_account FK.

create table if not exists public.marketing_content_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  collection_id text not null,
  logical_observation_key text not null,
  candidate_id text not null,
  human_review_id text not null,
  platform text not null,
  channel text not null,
  external_post_id text,
  external_url text,
  published_at timestamptz,
  publication_source text not null default 'manual',
  content_origin text not null,
  collection_status text not null,
  observed_at timestamptz not null,
  data_availability text not null default 'unavailable',
  topic text,
  destinations jsonb not null default '[]'::jsonb,
  format text,
  commercial_intent text,
  product_linked boolean not null default false,
  sample_quality text,
  reason text,
  provider_metadata jsonb not null default '{}'::jsonb,
  normalized_metrics jsonb,
  created_at timestamptz not null default now(),
  constraint marketing_content_perf_snapshots_origin_check
    check (content_origin in ('ai_unchanged', 'human_edited')),
  constraint marketing_content_perf_snapshots_source_check
    check (publication_source = 'manual'),
  constraint marketing_content_perf_snapshots_data_avail_check
    check (data_availability in ('available', 'partial', 'unavailable')),
  constraint marketing_content_perf_snapshots_logical_key_unique
    unique (logical_observation_key)
);

comment on table public.marketing_content_performance_snapshots is
  'Read-only performance observations for manually published marketing content. Not ExternalPublication.';

create index if not exists idx_marketing_content_perf_candidate_observed
  on public.marketing_content_performance_snapshots (candidate_id, observed_at desc);

create index if not exists idx_marketing_content_perf_review
  on public.marketing_content_performance_snapshots (human_review_id);

create index if not exists idx_marketing_content_perf_observed
  on public.marketing_content_performance_snapshots (observed_at desc);

create table if not exists public.marketing_content_performance_metrics (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null
    references public.marketing_content_performance_snapshots (id) on delete cascade,
  metric_type text not null,
  metric_value numeric not null,
  unit text,
  created_at timestamptz not null default now(),
  constraint marketing_content_perf_metrics_unique
    unique (snapshot_id, metric_type)
);

comment on table public.marketing_content_performance_metrics is
  'Normalized metric values per content performance snapshot. Absent metric != zero.';

create index if not exists idx_marketing_content_perf_metrics_type
  on public.marketing_content_performance_metrics (metric_type);

alter table public.marketing_content_performance_snapshots enable row level security;
alter table public.marketing_content_performance_metrics enable row level security;

drop policy if exists service_role_all_marketing_content_perf_snapshots
  on public.marketing_content_performance_snapshots;
create policy service_role_all_marketing_content_perf_snapshots
  on public.marketing_content_performance_snapshots for all to service_role using (true) with check (true);

drop policy if exists service_role_all_marketing_content_perf_metrics
  on public.marketing_content_performance_metrics;
create policy service_role_all_marketing_content_perf_metrics
  on public.marketing_content_performance_metrics for all to service_role using (true) with check (true);

revoke all on public.marketing_content_performance_snapshots from anon, authenticated;
revoke all on public.marketing_content_performance_metrics from anon, authenticated;

grant all on public.marketing_content_performance_snapshots to service_role;
grant all on public.marketing_content_performance_metrics to service_role;
