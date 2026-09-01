-- STEP 3-7: Daily autonomous marketing pipeline persistence.
-- Pre-publication internal artifacts only. No SNS credentials.

create table if not exists public.daily_marketing_runs (
  id uuid primary key default gen_random_uuid(),
  logical_run_key text not null unique,
  run_id text not null,
  business_date_kst text not null,
  routine_id text not null,
  correlation_id text,
  status text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.daily_marketing_runs is
  'Logical daily marketing run state. Idempotent by business date KST + routine. Not ExternalPublication.';

create index if not exists idx_daily_marketing_runs_business_date
  on public.daily_marketing_runs (business_date_kst desc);

create table if not exists public.completed_marketing_candidates (
  id uuid primary key default gen_random_uuid(),
  logical_run_key text not null unique,
  candidate_id text not null,
  run_id text not null,
  business_date_kst text not null,
  status text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.completed_marketing_candidates is
  'Completed pre-publication marketing candidate awaiting human review. Not MarketingPost.';

create index if not exists idx_completed_marketing_candidates_business_date
  on public.completed_marketing_candidates (business_date_kst desc);

alter table public.daily_marketing_runs enable row level security;
alter table public.completed_marketing_candidates enable row level security;

drop policy if exists service_role_all_daily_marketing_runs on public.daily_marketing_runs;
create policy service_role_all_daily_marketing_runs
  on public.daily_marketing_runs for all to service_role using (true) with check (true);

drop policy if exists service_role_all_completed_marketing_candidates on public.completed_marketing_candidates;
create policy service_role_all_completed_marketing_candidates
  on public.completed_marketing_candidates for all to service_role using (true) with check (true);

revoke all on public.daily_marketing_runs from anon, authenticated;
revoke all on public.completed_marketing_candidates from anon, authenticated;
grant all on public.daily_marketing_runs to service_role;
grant all on public.completed_marketing_candidates to service_role;
