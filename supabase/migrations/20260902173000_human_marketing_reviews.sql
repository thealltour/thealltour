-- STEP 3-8: Human marketing review state (pre-publication business records only).

create table if not exists public.human_marketing_reviews (
  id uuid primary key default gen_random_uuid(),
  review_id text not null unique,
  candidate_id text not null unique,
  run_id text not null,
  status text not null,
  payload jsonb not null,
  original_draft jsonb not null,
  current_draft jsonb not null,
  human_notes text,
  rejection_reason text,
  deferred_until timestamptz,
  manual_publication jsonb,
  reviewed_by text,
  governance_reviewed_draft_body text not null,
  human_edited_after_governance boolean not null default false,
  approved_at timestamptz,
  manually_published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.human_marketing_reviews is
  'Human review state for CompletedMarketingCandidate. Not ExternalPublication.';

create index if not exists idx_human_marketing_reviews_status
  on public.human_marketing_reviews (status, updated_at desc);

create index if not exists idx_human_marketing_reviews_run_id
  on public.human_marketing_reviews (run_id);

alter table public.human_marketing_reviews enable row level security;

drop policy if exists service_role_all_human_marketing_reviews on public.human_marketing_reviews;
create policy service_role_all_human_marketing_reviews
  on public.human_marketing_reviews for all to service_role using (true) with check (true);

revoke all on public.human_marketing_reviews from anon, authenticated;
grant all on public.human_marketing_reviews to service_role;
