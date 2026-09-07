-- PR-9D: Aviasales autocomplete / prices cache (service_role only).
-- Mirrors wegotrip_api_cache key/payload shape — no large abstraction.

create table if not exists public.aviasales_api_cache (
  cache_key text primary key,
  kind text not null,
  payload_json jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_aviasales_api_cache_expires_at
  on public.aviasales_api_cache (expires_at);

create index if not exists idx_aviasales_api_cache_kind
  on public.aviasales_api_cache (kind);

comment on table public.aviasales_api_cache is
  'Aviasales IATA/place + prices_for_dates cache (PR-9D). service_role only.';

alter table public.aviasales_api_cache enable row level security;

drop policy if exists service_role_all_aviasales_api_cache
  on public.aviasales_api_cache;
create policy service_role_all_aviasales_api_cache
  on public.aviasales_api_cache
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.aviasales_api_cache from anon, authenticated;
grant all on public.aviasales_api_cache to service_role;
