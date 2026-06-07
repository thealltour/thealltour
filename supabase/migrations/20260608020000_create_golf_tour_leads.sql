-- 골프투어 패키지 리드(UTM 추적). API(service_role) 경유 적재 전용.

create extension if not exists "pgcrypto";

create table if not exists public.golf_tour_leads (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique,
  customer_name text not null,
  phone_number text not null,
  group_size integer,
  target_destination text,
  landing_page text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  acquisition_channel text,
  status text not null default 'PENDING',
  actual_revenue numeric(12,2) not null default 0.00,
  created_at timestamptz not null default now()
);

comment on table public.golf_tour_leads is '골프투어 패키지 리드(UTM 추적). API(service_role) 경유 적재 전용.';

create index if not exists idx_golf_tour_leads_created on public.golf_tour_leads (created_at desc);
create index if not exists idx_golf_tour_leads_channel_created on public.golf_tour_leads (acquisition_channel, created_at desc);
create index if not exists idx_golf_tour_leads_utm on public.golf_tour_leads (utm_source, utm_medium, utm_campaign);
create index if not exists idx_golf_tour_leads_status on public.golf_tour_leads (status, created_at desc);

alter table public.golf_tour_leads enable row level security;
-- anon/authenticated 정책을 의도적으로 두지 않음. service_role(supabaseAdmin)만 RLS 우회 접근.
