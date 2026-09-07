-- Planner Affiliate Router v0: attribution + click tokens
-- Access: service_role / server API only.
-- affiliate_offer_tokens.target_url is server-only (never exposed to client).

create table if not exists public.affiliate_offer_tokens (
  id uuid primary key default gen_random_uuid(),
  planner_session_id uuid not null
    references public.planner_sessions (id) on delete cascade,
  provider_id text not null,
  category text not null,
  placement text not null,
  target_url text not null,
  title text not null,
  description text null,
  cta_label text not null,
  destination text null,
  source_product_id uuid null,
  day_number integer null,
  item_order integer null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

comment on table public.affiliate_offer_tokens is
  'Opaque tracking tokens for Planner affiliate offers. target_url is server-only.';

create index if not exists affiliate_offer_tokens_session_idx
  on public.affiliate_offer_tokens (planner_session_id);

alter table public.affiliate_offer_tokens enable row level security;

drop policy if exists service_role_all_affiliate_offer_tokens on public.affiliate_offer_tokens;
create policy service_role_all_affiliate_offer_tokens
  on public.affiliate_offer_tokens
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.affiliate_offer_tokens from anon, authenticated;
grant all on public.affiliate_offer_tokens to service_role;

create table if not exists public.affiliate_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('impression', 'click')),
  planner_session_id uuid null
    references public.planner_sessions (id) on delete set null,
  member_id uuid null,
  provider_id text not null,
  category text not null,
  placement text not null,
  tracking_token text null,
  destination text null,
  source_product_id uuid null,
  day_number integer null,
  item_order integer null,
  created_at timestamptz not null default now()
);

comment on table public.affiliate_events is
  'Affiliate attribution SoT (impression/click). Funnel analytics may mirror via analytics_events.';

create index if not exists affiliate_events_session_idx
  on public.affiliate_events (planner_session_id, created_at desc);

create index if not exists affiliate_events_token_type_idx
  on public.affiliate_events (tracking_token, event_type)
  where tracking_token is not null;

create unique index if not exists affiliate_events_impression_dedupe_idx
  on public.affiliate_events (tracking_token)
  where event_type = 'impression' and tracking_token is not null;

alter table public.affiliate_events enable row level security;

drop policy if exists service_role_all_affiliate_events on public.affiliate_events;
create policy service_role_all_affiliate_events
  on public.affiliate_events
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.affiliate_events from anon, authenticated;
grant all on public.affiliate_events to service_role;
