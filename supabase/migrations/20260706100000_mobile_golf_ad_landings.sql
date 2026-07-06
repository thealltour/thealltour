-- 모바일 골프 광고 랜딩 (카카오 비즈보드 등). 관리자 API(service_role) 경유 CRUD.

create extension if not exists "pgcrypto";

create table if not exists public.mobile_golf_ad_landings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  hero_image_url text not null,
  benefit_text text not null,
  trust_action_text text not null,
  is_published boolean not null default false,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.mobile_golf_ad_landings is '모바일 골프 광고 랜딩 (카카오 비즈보드 유입). /golf/ads/[slug]';

create index if not exists idx_mobile_golf_ad_landings_slug on public.mobile_golf_ad_landings (slug);
create index if not exists idx_mobile_golf_ad_landings_published on public.mobile_golf_ad_landings (is_published, updated_at desc);

alter table public.mobile_golf_ad_landings enable row level security;

create policy "mobile_golf_ad_landings_public_read"
  on public.mobile_golf_ad_landings
  for select
  to anon, authenticated
  using (is_published = true);
