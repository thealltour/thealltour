-- OBS-3: Durable Marketing Trace / Span storage (OTel-compatible domain model).
-- Service-role only. No anon/authenticated access. No prompts/secrets in attributes.
-- Recommended retention: 30–90 days (cleanup job deferred to OBS-6+).
-- Realtime: INSERT/UPDATE on these tables can be subscribed later; not enabled here.

create table if not exists public.marketing_observability_traces (
  trace_id text primary key
    constraint marketing_obs_traces_trace_id_hex
      check (trace_id ~ '^[0-9a-f]{32}$' and trace_id !~ '^0{32}$'),
  schema_version text not null default '1',
  trace_type text not null,
  status text not null
    constraint marketing_obs_traces_status_check
      check (status in ('running', 'completed', 'failed', 'partial')),

  production_request_id text,
  logical_run_key text,
  agenda_slate_id text,
  agenda_candidate_id text,
  assignment_id text,
  completed_candidate_id text,
  hmr_id text,
  run_id text,
  correlation_id text,
  research_brief_id text,
  governance_review_id text,
  business_date_kst text,

  root_span_id text
    constraint marketing_obs_traces_root_span_id_hex
      check (
        root_span_id is null
        or (root_span_id ~ '^[0-9a-f]{16}$' and root_span_id !~ '^0{16}$')
      ),

  started_at timestamptz not null,
  ended_at timestamptz,
  duration_ms integer
    constraint marketing_obs_traces_duration_nonneg check (duration_ms is null or duration_ms >= 0),

  attributes jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_observability_spans (
  trace_id text not null
    references public.marketing_observability_traces (trace_id)
    on delete cascade,
  span_id text not null
    constraint marketing_obs_spans_span_id_hex
      check (span_id ~ '^[0-9a-f]{16}$' and span_id !~ '^0{16}$'),
  parent_span_id text
    constraint marketing_obs_spans_parent_span_id_hex
      check (
        parent_span_id is null
        or (parent_span_id ~ '^[0-9a-f]{16}$' and parent_span_id !~ '^0{16}$')
      ),

  schema_version text not null default '1',
  name text not null,
  kind text not null,
  actor_type text not null,
  actor_id text,
  stage text not null,
  attempt integer not null default 1
    constraint marketing_obs_spans_attempt_pos check (attempt >= 1),

  business_status text not null
    constraint marketing_obs_spans_business_status_check
      check (
        business_status in (
          'running',
          'ok',
          'error',
          'skipped',
          'revision_required',
          'blocked'
        )
      ),
  otel_status_code text not null default 'UNSET'
    constraint marketing_obs_spans_otel_status_check
      check (otel_status_code in ('UNSET', 'OK', 'ERROR')),

  started_at timestamptz not null,
  ended_at timestamptz,
  duration_ms integer
    constraint marketing_obs_spans_duration_nonneg check (duration_ms is null or duration_ms >= 0),

  attributes jsonb not null default '{}'::jsonb,

  error_class text,
  error_code text,
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (trace_id, span_id)
);

-- No parent_span_id self-FK: start/end write ordering can race under fire-and-forget persistence.

create index if not exists idx_marketing_obs_traces_started_at
  on public.marketing_observability_traces (started_at desc);

create index if not exists idx_marketing_obs_traces_production_request_id
  on public.marketing_observability_traces (production_request_id);

create index if not exists idx_marketing_obs_traces_logical_run_key
  on public.marketing_observability_traces (logical_run_key);

create index if not exists idx_marketing_obs_traces_status
  on public.marketing_observability_traces (status, started_at desc);

create index if not exists idx_marketing_obs_spans_trace_id
  on public.marketing_observability_spans (trace_id);

create index if not exists idx_marketing_obs_spans_stage
  on public.marketing_observability_spans (stage);

create index if not exists idx_marketing_obs_spans_actor_id
  on public.marketing_observability_spans (actor_id);

create index if not exists idx_marketing_obs_spans_business_status
  on public.marketing_observability_spans (business_status);

create index if not exists idx_marketing_obs_spans_error_class
  on public.marketing_observability_spans (error_class);

comment on table public.marketing_observability_traces is
  'OBS-3 durable MarketingTrace. Soft correlation ids only. No prompts/secrets. Retention 30-90d recommended.';

comment on table public.marketing_observability_spans is
  'OBS-3 durable MarketingSpan. business_status ≠ otel_status_code. Parent self-FK omitted for write ordering.';

alter table public.marketing_observability_traces enable row level security;
alter table public.marketing_observability_spans enable row level security;

drop policy if exists service_role_all_marketing_observability_traces
  on public.marketing_observability_traces;
create policy service_role_all_marketing_observability_traces
  on public.marketing_observability_traces
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists service_role_all_marketing_observability_spans
  on public.marketing_observability_spans;
create policy service_role_all_marketing_observability_spans
  on public.marketing_observability_spans
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.marketing_observability_traces from anon, authenticated;
revoke all on public.marketing_observability_spans from anon, authenticated;
grant all on public.marketing_observability_traces to service_role;
grant all on public.marketing_observability_spans to service_role;
