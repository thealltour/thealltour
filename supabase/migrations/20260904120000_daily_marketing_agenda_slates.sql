-- STEP G-1/G-2: Daily human-reviewable agenda slate persistence.
-- Additive only. Does not mutate historical daily marketing rows.
-- Pre-selection artifact: no Content Strategy / draft / publication.

create table if not exists public.daily_marketing_agenda_slates (
  id uuid primary key default gen_random_uuid(),
  logical_run_key text not null unique,
  slate_id text not null,
  run_id text not null,
  business_date_kst text not null,
  routine_id text not null,
  status text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.daily_marketing_agenda_slates is
  'Daily human-gated agenda slate (5-8 candidates). Production does not start until human selection. Not CompletedMarketingCandidate.';

create index if not exists idx_daily_marketing_agenda_slates_business_date
  on public.daily_marketing_agenda_slates (business_date_kst desc);

alter table public.daily_marketing_agenda_slates enable row level security;

drop policy if exists service_role_all_daily_marketing_agenda_slates on public.daily_marketing_agenda_slates;
create policy service_role_all_daily_marketing_agenda_slates
  on public.daily_marketing_agenda_slates for all to service_role using (true) with check (true);

revoke all on public.daily_marketing_agenda_slates from anon, authenticated;
grant all on public.daily_marketing_agenda_slates to service_role;
