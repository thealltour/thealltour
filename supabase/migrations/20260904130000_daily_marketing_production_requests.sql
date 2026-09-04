-- STEP G-5: Durable per-selection marketing production requests (queue).
-- Additive only. Does not mutate historical CompletedMarketingCandidate rows.
-- Browser/admin click persists QUEUED requests; Pi worker may process later.

create table if not exists public.daily_marketing_production_requests (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  logical_run_key text not null unique,
  slate_id text not null,
  slate_item_id text not null,
  business_date_kst text not null,
  status text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.daily_marketing_production_requests is
  'Human-selected agenda production requests (QUEUED/RUNNING/COMPLETED/FAILED). One durable row per production logical_run_key. Does not auto-publish.';

create index if not exists idx_daily_marketing_production_requests_business_date
  on public.daily_marketing_production_requests (business_date_kst desc);

create index if not exists idx_daily_marketing_production_requests_status
  on public.daily_marketing_production_requests (status, created_at);

alter table public.daily_marketing_production_requests enable row level security;

drop policy if exists service_role_all_daily_marketing_production_requests
  on public.daily_marketing_production_requests;
create policy service_role_all_daily_marketing_production_requests
  on public.daily_marketing_production_requests for all to service_role using (true) with check (true);

revoke all on public.daily_marketing_production_requests from anon, authenticated;
grant all on public.daily_marketing_production_requests to service_role;
