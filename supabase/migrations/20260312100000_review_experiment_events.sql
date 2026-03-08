-- PR26: 리뷰 A/B 실험 이벤트 저장.
-- impression / click_review / expand_review / click_helpful / view_summary / conversion

create table if not exists public.review_experiment_events (
  id uuid primary key default gen_random_uuid(),
  experiment_key text not null,
  variant text not null,
  product_id text not null,
  event_type text not null,
  review_id text,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_review_experiment_events_exp_variant
  on public.review_experiment_events(experiment_key, variant);
create index if not exists idx_review_experiment_events_product
  on public.review_experiment_events(product_id);
create index if not exists idx_review_experiment_events_occurred
  on public.review_experiment_events(occurred_at desc);

comment on table public.review_experiment_events is 'PR26: 리뷰 실험 노출/클릭/확장/전환 이벤트';
