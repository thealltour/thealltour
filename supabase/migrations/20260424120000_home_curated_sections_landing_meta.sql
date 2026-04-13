-- Admin 랜딩 일괄 생성·편집이 기대하는 home_curated_sections 컬럼
-- (기존 baseline에는 없고 코드만 참조하던 필드 — 누락 시 insert 폴백 8회 초과로 전부 실패할 수 있음)

alter table public.home_curated_sections add column if not exists updated_at timestamptz not null default now();

alter table public.home_curated_sections add column if not exists template_type text;
alter table public.home_curated_sections add column if not exists source_path text;
alter table public.home_curated_sections add column if not exists quote_category text;
alter table public.home_curated_sections add column if not exists source_taxonomy_id text;
alter table public.home_curated_sections add column if not exists source_taxonomy_type text;
alter table public.home_curated_sections add column if not exists source_taxonomy_slug text;
alter table public.home_curated_sections add column if not exists seo_title text;
alter table public.home_curated_sections add column if not exists seo_description text;

comment on column public.home_curated_sections.template_type is '랜딩 템플릿 (destination_consulting 등)';
comment on column public.home_curated_sections.source_taxonomy_id is '연결 taxonomy id';
comment on column public.home_curated_sections.source_taxonomy_type is 'destination | theme | product_line';
comment on column public.home_curated_sections.source_taxonomy_slug is '연결 taxonomy slug 스냅샷';
