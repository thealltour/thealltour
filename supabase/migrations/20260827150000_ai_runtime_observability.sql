-- AI Runtime shared observability events (append-only telemetry).
-- Execution control (scheduler queue, reservations, routing) remains process-local.
-- Recommended retention: 30–90 days (cleanup job deferred).
-- Access: service_role only via Admin API; no browser/anon table reads.

create table if not exists public.ai_runtime_observability_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,

  request_id text,
  correlation_id text,
  job_id text,

  agent_id text,
  source text,
  workload text,
  priority text,

  provider_id text,
  model_id text,

  status text,
  error_code text,
  retryable boolean,

  fallback_used boolean,
  attempt_count integer,

  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  usage_missing boolean,

  reserved_input_tokens integer,
  reserved_output_tokens integer,
  reserved_total_tokens integer,

  latency_ms integer,

  metadata_json jsonb not null default '{}'::jsonb,

  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_runtime_obs_occurred_at
  on public.ai_runtime_observability_events (occurred_at desc);

create index if not exists idx_ai_runtime_obs_correlation_id
  on public.ai_runtime_observability_events (correlation_id);

create index if not exists idx_ai_runtime_obs_request_id
  on public.ai_runtime_observability_events (request_id);

create index if not exists idx_ai_runtime_obs_event_type
  on public.ai_runtime_observability_events (event_type);

create index if not exists idx_ai_runtime_obs_provider_id
  on public.ai_runtime_observability_events (provider_id);

create index if not exists idx_ai_runtime_obs_source_workload
  on public.ai_runtime_observability_events (source, workload);

comment on table public.ai_runtime_observability_events is
  'Append-only AI Runtime observability. No prompts/secrets. Retention 30-90 days recommended.';

alter table public.ai_runtime_observability_events enable row level security;

drop policy if exists service_role_all_ai_runtime_observability_events
  on public.ai_runtime_observability_events;
create policy service_role_all_ai_runtime_observability_events
  on public.ai_runtime_observability_events
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.ai_runtime_observability_events from anon, authenticated;
grant all on public.ai_runtime_observability_events to service_role;
