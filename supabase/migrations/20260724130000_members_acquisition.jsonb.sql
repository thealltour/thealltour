-- 카카오싱크·비즈보드 가입 귀속 (UTM·랜딩 경로)

alter table public.members
  add column if not exists acquisition jsonb;

comment on column public.members.acquisition is
  '카카오 OAuth 가입 시 유입 귀속 {utm_source,utm_medium,utm_campaign,utm_term,utm_content,landing_path,landing_slug}';

create index if not exists members_acquisition_utm_campaign_idx
  on public.members ((acquisition ->> 'utm_campaign'))
  where acquisition is not null;
