-- 카카오모먼트 월간 CSV 스냅샷 (소재 단위). service_role 전용.

create extension if not exists "pgcrypto";

create table if not exists public.kakao_moment_imports (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  filename text not null default '',
  uploaded_by text,
  created_at timestamptz not null default now(),
  constraint kakao_moment_imports_period_chk check (period_end >= period_start),
  constraint kakao_moment_imports_period_unique unique (period_start, period_end)
);

comment on table public.kakao_moment_imports is '카카오모먼트 CSV 월간 임포트 배치. 동일 기간 재업로드 시 교체.';

create table if not exists public.kakao_moment_creatives (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.kakao_moment_imports (id) on delete cascade,
  creative_name text not null default '',
  creative_id text,
  status text,
  ad_group_name text,
  ad_group_id text,
  campaign_name text,
  campaign_id text,
  cost numeric(14, 2) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  ctr numeric(12, 8) not null default 0,
  reach bigint not null default 0,
  cpc numeric(14, 4) not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.kakao_moment_creatives is '카카오모먼트 소재별 성과 (임포트 배치 소속).';

create index if not exists idx_kakao_moment_creatives_import
  on public.kakao_moment_creatives (import_id);
create index if not exists idx_kakao_moment_creatives_campaign
  on public.kakao_moment_creatives (campaign_id);
create index if not exists idx_kakao_moment_imports_created
  on public.kakao_moment_imports (created_at desc);

alter table public.kakao_moment_imports enable row level security;
alter table public.kakao_moment_creatives enable row level security;

drop policy if exists service_role_all_kakao_moment_imports on public.kakao_moment_imports;
create policy service_role_all_kakao_moment_imports
  on public.kakao_moment_imports for all to service_role using (true) with check (true);

drop policy if exists service_role_all_kakao_moment_creatives on public.kakao_moment_creatives;
create policy service_role_all_kakao_moment_creatives
  on public.kakao_moment_creatives for all to service_role using (true) with check (true);

revoke all on public.kakao_moment_imports from anon, authenticated;
revoke all on public.kakao_moment_creatives from anon, authenticated;
grant all on public.kakao_moment_imports to service_role;
grant all on public.kakao_moment_creatives to service_role;
