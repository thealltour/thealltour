-- 유인물 A4 draft 저장 (관리자 API + service_role 전용, 공개 share route 확장 대비 share_slug)

create table if not exists public.flyer_drafts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  template_key text not null default 'a4-portrait-default',
  title text,
  subtitle text,
  sections_json jsonb not null,
  fields_json jsonb not null,
  image_urls_json jsonb not null default '[]'::jsonb,
  preview_version integer not null default 1,
  png_file_url text,
  share_slug text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists flyer_drafts_share_slug_key
  on public.flyer_drafts (share_slug)
  where share_slug is not null;

create index if not exists idx_flyer_drafts_product_id
  on public.flyer_drafts (product_id);

create index if not exists idx_flyer_drafts_updated_at
  on public.flyer_drafts (updated_at desc);

comment on table public.flyer_drafts is '관리자 유인물(A4) 편집 draft; 공개 공유는 share_slug + 별도 route로 확장';

alter table public.flyer_drafts enable row level security;
