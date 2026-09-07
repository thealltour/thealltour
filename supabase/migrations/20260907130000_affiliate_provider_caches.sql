-- PR-9C: Airalo / WeGoTrip server-only caches (service_role only).
-- Airalo stores normalized catalog subset only — never raw XML/feed blobs.

create table if not exists public.airalo_esim_catalog_cache (
  cache_key text primary key,
  records_json jsonb not null,
  record_count integer not null default 0,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_airalo_esim_catalog_cache_expires_at
  on public.airalo_esim_catalog_cache (expires_at);

comment on table public.airalo_esim_catalog_cache is
  'Normalized Airalo eSIM catalog (PR-9C). TTL ~12h; stale fallback on fetch failure.';

alter table public.airalo_esim_catalog_cache enable row level security;

drop policy if exists service_role_all_airalo_esim_catalog_cache
  on public.airalo_esim_catalog_cache;
create policy service_role_all_airalo_esim_catalog_cache
  on public.airalo_esim_catalog_cache
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.airalo_esim_catalog_cache from anon, authenticated;
grant all on public.airalo_esim_catalog_cache to service_role;

create table if not exists public.wegotrip_api_cache (
  cache_key text primary key,
  kind text not null,
  payload_json jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_wegotrip_api_cache_expires_at
  on public.wegotrip_api_cache (expires_at);

create index if not exists idx_wegotrip_api_cache_kind
  on public.wegotrip_api_cache (kind);

comment on table public.wegotrip_api_cache is
  'WeGoTrip city/products/capabilities cache (PR-9C). service_role only.';

alter table public.wegotrip_api_cache enable row level security;

drop policy if exists service_role_all_wegotrip_api_cache
  on public.wegotrip_api_cache;
create policy service_role_all_wegotrip_api_cache
  on public.wegotrip_api_cache
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.wegotrip_api_cache from anon, authenticated;
grant all on public.wegotrip_api_cache to service_role;
