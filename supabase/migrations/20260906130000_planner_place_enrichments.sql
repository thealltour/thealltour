-- Free Travel Planner PR-7A: place enrichment (Reality Layer)
-- Access: service_role / server API only.
-- Google Place IDs may be stored long-term; display attributes are refreshable cache (TTL app-side).

create table if not exists public.planner_place_enrichments (
  id uuid primary key default gen_random_uuid(),
  planner_session_id uuid not null
    references public.planner_sessions (id) on delete cascade,
  day_number integer not null check (day_number >= 1),
  item_order integer not null check (item_order >= 1),
  original_name text not null,
  resolution_status text not null
    check (resolution_status in ('resolved', 'ambiguous', 'unresolved')),
  provider text not null default 'google_places',
  provider_place_id text null,
  display_name text null,
  formatted_address text null,
  latitude double precision null,
  longitude double precision null,
  types_json jsonb not null default '[]'::jsonb,
  provider_url text null,
  plan_fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (planner_session_id, day_number, item_order, plan_fingerprint)
);

comment on table public.planner_place_enrichments is
  'Places API (New) enrichment for planner itinerary items. Separate from AI plan_json.';

create index if not exists planner_place_enrichments_session_fp_idx
  on public.planner_place_enrichments (planner_session_id, plan_fingerprint);

alter table public.planner_place_enrichments enable row level security;

drop policy if exists service_role_all_planner_place_enrichments on public.planner_place_enrichments;
create policy service_role_all_planner_place_enrichments
  on public.planner_place_enrichments
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.planner_place_enrichments from anon, authenticated;
grant all on public.planner_place_enrichments to service_role;
