-- Travelpayouts commerce attribution foundation (PR-9A)
-- Additive only; compatible with existing affiliate_offer_tokens rows.

alter table public.affiliate_offer_tokens
  add column if not exists provider_sub_id text null;

alter table public.affiliate_offer_tokens
  add column if not exists affiliate_network text null;

alter table public.affiliate_offer_tokens
  add column if not exists affiliate_campaign_id text null;

alter table public.affiliate_offer_tokens
  add column if not exists source_url_host text null;

comment on column public.affiliate_offer_tokens.provider_sub_id is
  'Opaque Travelpayouts (or other network) SubID for Statistics join; not the internal tracking token.';

comment on column public.affiliate_offer_tokens.affiliate_network is
  'Affiliate network id, e.g. travelpayouts.';

comment on column public.affiliate_offer_tokens.affiliate_campaign_id is
  'Optional campaign/program marker for future conversion joins.';

comment on column public.affiliate_offer_tokens.source_url_host is
  'Hostname of pre-affiliate brand URL for audit (no full URL/query stored).';

-- Unique when set (Travelpayouts SubID must map to one offer token).
create unique index if not exists affiliate_offer_tokens_provider_sub_id_uidx
  on public.affiliate_offer_tokens (provider_sub_id)
  where provider_sub_id is not null;

create index if not exists affiliate_offer_tokens_network_idx
  on public.affiliate_offer_tokens (affiliate_network)
  where affiliate_network is not null;
