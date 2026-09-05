-- Free Travel Planner PR-7B: route enrichment (Map + Routes Reality Layer)
-- Access: service_role / server API only.
-- Duration/distance are TTL-cached display attributes (refresh with fingerprint/TTL).

create table if not exists public.planner_route_enrichments (
  id uuid primary key default gen_random_uuid(),
  planner_session_id uuid not null
    references public.planner_sessions (id) on delete cascade,
  day_number integer not null check (day_number >= 1),
  from_item_order integer not null check (from_item_order >= 1),
  to_item_order integer not null check (to_item_order >= 1),
  route_status text not null
    check (route_status in ('resolved', 'unavailable', 'failed')),
  travel_mode text not null
    check (travel_mode in ('walk', 'public_transit', 'drive', 'other')),
  duration_minutes integer null,
  distance_meters integer null,
  provider text not null default 'google_routes',
  plan_fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (
    planner_session_id,
    day_number,
    from_item_order,
    to_item_order,
    plan_fingerprint
  )
);

comment on table public.planner_route_enrichments is
  'Google Routes API enrichment for consecutive itinerary pairs. Separate from AI plan_json.';

create index if not exists planner_route_enrichments_session_fp_idx
  on public.planner_route_enrichments (planner_session_id, plan_fingerprint);

alter table public.planner_route_enrichments enable row level security;

drop policy if exists service_role_all_planner_route_enrichments on public.planner_route_enrichments;
create policy service_role_all_planner_route_enrichments
  on public.planner_route_enrichments
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.planner_route_enrichments from anon, authenticated;
grant all on public.planner_route_enrichments to service_role;
