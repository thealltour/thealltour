-- Free Travel Planner PR-6: plan version history for safe AI edits
-- Access: service_role / server API only (supabaseAdmin). No anon browser writes.

create table if not exists public.planner_plan_versions (
  id uuid primary key default gen_random_uuid(),
  planner_session_id uuid not null
    references public.planner_sessions (id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  plan_json jsonb not null,
  edit_instruction text null,
  created_at timestamptz not null default now(),
  unique (planner_session_id, version_number)
);

comment on table public.planner_plan_versions is
  'Planner plan_json version snapshots. edit_instruction is server-only (never expose in Result DTO).';

comment on column public.planner_plan_versions.edit_instruction is
  'User natural-language edit that produced this version. Null for bootstrap original plan.';

create index if not exists planner_plan_versions_session_version_idx
  on public.planner_plan_versions (planner_session_id, version_number desc);

alter table public.planner_plan_versions enable row level security;

drop policy if exists service_role_all_planner_plan_versions on public.planner_plan_versions;
create policy service_role_all_planner_plan_versions
  on public.planner_plan_versions
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.planner_plan_versions from anon, authenticated;
grant all on public.planner_plan_versions to service_role;
