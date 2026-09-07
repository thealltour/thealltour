-- PR-9G affiliate percent canary ops queries
-- Columns from migrations:
--   20260907110000_planner_affiliate_router_v0.sql
--   20260907120000_travelpayouts_affiliate_attribution.sql
-- Run in Supabase SQL editor / psql with service role as needed.

-- Impressions last 24h (proxy for "exposed" — excluded canary never creates tokens)
select
  date_trunc('hour', created_at) as hour,
  provider_id,
  count(*) as impressions
from public.affiliate_events
where event_type = 'impression'
  and created_at > now() - interval '24 hours'
group by 1, 2
order by 1 desc, 3 desc;

-- Clicks last 24h
select
  date_trunc('hour', created_at) as hour,
  provider_id,
  count(*) as clicks
from public.affiliate_events
where event_type = 'click'
  and created_at > now() - interval '24 hours'
group by 1, 2
order by 1 desc, 3 desc;

-- Impression → click funnel (token-level) last 7 days
select
  i.provider_id,
  count(distinct i.tracking_token) as impressed_tokens,
  count(distinct c.tracking_token) as clicked_tokens
from public.affiliate_events i
left join public.affiliate_events c
  on c.tracking_token = i.tracking_token
 and c.event_type = 'click'
where i.event_type = 'impression'
  and i.created_at > now() - interval '7 days'
group by 1
order by 2 desc;

-- Tokens minted last 24h (new offer issuance)
select
  provider_id,
  count(*) as tokens,
  count(*) filter (where expires_at > now()) as unexpired
from public.affiliate_offer_tokens
where created_at > now() - interval '24 hours'
group by 1
order by 2 desc;

-- Recent tokens sample (no target_url in select — ops sanity only)
select
  id,
  planner_session_id,
  provider_id,
  category,
  placement,
  destination,
  created_at,
  expires_at
from public.affiliate_offer_tokens
order by created_at desc
limit 50;
