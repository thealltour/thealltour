-- PR14: 상품별 리뷰 AI 요약 테이블
-- submitted 리뷰 기반 요약, positive/negative/recommended_for, stale/ready/failed 상태

create table if not exists public.product_review_summaries (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  review_count integer not null default 0,
  average_rating numeric(3,2),
  summary_text text,
  positive_points jsonb,
  negative_points jsonb,
  recommended_for jsonb,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_review_ids jsonb,
  status text not null default 'ready' check (status in ('ready', 'stale', 'failed'))
);

create unique index if not exists idx_product_review_summaries_product_id
  on public.product_review_summaries (product_id);

create index if not exists idx_product_review_summaries_updated_at
  on public.product_review_summaries (updated_at desc);

create index if not exists idx_product_review_summaries_status
  on public.product_review_summaries (status);

comment on table public.product_review_summaries is 'PR14: 상품별 공개 리뷰 기반 AI 요약. status=ready만 상세 노출, stale 시 재생성 권장.';

alter table public.product_review_summaries enable row level security;

drop policy if exists "product_review_summaries_service_role" on public.product_review_summaries;
create policy "product_review_summaries_service_role" on public.product_review_summaries
  for all to service_role using (true) with check (true);

-- anon은 select만 (상품 상세에서 요약 카드 표시용)
drop policy if exists "product_review_summaries_anon_read" on public.product_review_summaries;
create policy "product_review_summaries_anon_read" on public.product_review_summaries
  for select to anon using (true);
