-- T-2: travel_trends_staging — Meta AI TrendSignal human-assisted ingest staging.
-- provider_cluster_hint is NOT a dedupe key; uniqueness is (provider, observation_id).

create table if not exists public.travel_trends_staging (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_run_id text not null,
  provider_run_at timestamptz not null,
  observation_id text not null,
  provider_cluster_hint text null,
  cluster_label text null,
  observed_at timestamptz not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  trend_type text not null,
  vertical_tags text[] not null default '{}'::text[],
  payload jsonb not null,
  status text not null default 'new'
    check (status in ('new', 'ingested', 'discarded')),
  created_at timestamptz not null default now(),
  ingested_at timestamptz null,
  discarded_at timestamptz null,
  discard_reason text null,
  constraint travel_trends_staging_provider_observation_uniq
    unique (provider, observation_id)
);

comment on table public.travel_trends_staging is
  'Human-assisted Meta TrendSignal staging. Dedupe key = (provider, observation_id). provider_cluster_hint is optional clustering metadata only.';

comment on column public.travel_trends_staging.provider_cluster_hint is
  'Optional provider cluster hint — NOT a uniqueness/dedupe key. Multiple observations may share a hint.';

create index if not exists idx_travel_trends_staging_cluster_observed
  on public.travel_trends_staging (provider_cluster_hint, observed_at desc);

create index if not exists idx_travel_trends_staging_status
  on public.travel_trends_staging (status);

create index if not exists idx_travel_trends_staging_trend_type
  on public.travel_trends_staging (trend_type);

alter table public.travel_trends_staging enable row level security;

-- Service-role only (no anon/authenticated policies) — matches marketing research pattern.
