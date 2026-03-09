-- 히어로 문구 단일 행 설정 (메인 배너 관리에서 편집)
create extension if not exists "pgcrypto";

create table if not exists public.home_hero_content (
  id uuid primary key default gen_random_uuid(),
  badge text,
  main_copy_accent text,
  main_copy_tail text,
  sub_description text,
  bullet_1 text,
  bullet_2 text,
  bullet_3 text,
  recommended_text text,
  search_placeholder text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.home_hero_content is '홈 히어로 문구(뱃지, 메인카피, 보조설명, 불릿, 추천탐색문구, 검색 플레이스홀더). 단일 행 사용.';

alter table public.home_hero_content enable row level security;

drop policy if exists "home_hero_content_select_anon" on public.home_hero_content;
create policy "home_hero_content_select_anon"
on public.home_hero_content
for select
to anon
using (true);

-- insert/update/delete는 서비스 역할에서만 (admin API에서 서비스 키 사용)
drop policy if exists "home_hero_content_all_service" on public.home_hero_content;
create policy "home_hero_content_all_service"
on public.home_hero_content
for all
to anon
using (true)
with check (true);
