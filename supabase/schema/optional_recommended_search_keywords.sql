-- =============================================================================
-- OPTIONAL: public.recommended_search_keywords
-- =============================================================================
--
-- 목적: repo 밖에서 생성되었을 가능성이 있는 객체를 source of truth 범위 안으로
--       편입하기 위한 선택 적용 스키마 파일입니다.
-- 적용: reset-guide 및 README에서 "선택 적용"으로 안내. 필수는 아님.
--
-- 앱 사용: api/search/recommended, api/search/recommended/[id]
-- 컬럼: id, keyword, sort_order, is_active, created_at, updated_at
-- =============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.recommended_search_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  sort_order integer,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_recommended_search_keywords_sort_order on public.recommended_search_keywords(sort_order);
create index if not exists idx_recommended_search_keywords_is_active on public.recommended_search_keywords(is_active) where is_active = true;

comment on table public.recommended_search_keywords is '추천 검색어. optional schema. 선택 적용.';
