-- STEP 3-1: Research Intelligence persistence schema.
-- Domain foundation only. No collector seeds, no credentials, no external writes.
--
-- Conventions: uuid PK, timestamptz, text status (app-level), RLS service_role only.

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1) research_sources
-- -----------------------------------------------------------------------------
create table if not exists public.research_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  name text not null,
  canonical_url text,
  provider text,
  authority_level text,
  default_credibility numeric(4, 3),
  locale text,
  country text,
  language text,
  is_official boolean not null default false,
  is_enabled boolean not null default true,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint research_sources_name_nonempty check (length(trim(name)) > 0)
);

comment on table public.research_sources is
  'Research source registry. Read-only intelligence layer — no SNS credentials.';

create index if not exists idx_research_sources_type_enabled
  on public.research_sources (source_type, is_enabled);

-- -----------------------------------------------------------------------------
-- 2) research_signals
-- -----------------------------------------------------------------------------
create table if not exists public.research_signals (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.research_sources (id) on delete restrict,
  source_type text not null,
  signal_type text not null,
  title text not null,
  summary text not null,
  claim text,
  claim_source text,
  canonical_url text,
  external_id text,
  published_at timestamptz,
  observed_at timestamptz not null,
  expires_at timestamptz,
  geography text[] not null default '{}',
  destinations text[] not null default '{}',
  topics text[] not null default '{}',
  entities text[] not null default '{}',
  language text not null default 'ko',
  raw_fingerprint text not null,
  normalized_fingerprint text,
  duplicate_of_signal_id uuid references public.research_signals (id) on delete set null,
  corroboration_count integer not null default 0,
  freshness jsonb,
  credibility jsonb,
  travel_relevance jsonb,
  public_interest_score numeric(4, 3),
  commercial_relevance jsonb,
  seasonality text,
  status text not null default 'observed',
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.research_signals is
  'Atomic research observations. Not PerformanceSnapshot or MarketingPost.';

create unique index if not exists idx_research_signals_raw_fingerprint
  on public.research_signals (raw_fingerprint);
create index if not exists idx_research_signals_normalized_fingerprint
  on public.research_signals (normalized_fingerprint)
  where normalized_fingerprint is not null;
create index if not exists idx_research_signals_canonical_url
  on public.research_signals (canonical_url)
  where canonical_url is not null;
create index if not exists idx_research_signals_external_id
  on public.research_signals (external_id)
  where external_id is not null;
create index if not exists idx_research_signals_status_observed
  on public.research_signals (status, observed_at desc);
create index if not exists idx_research_signals_destinations_gin
  on public.research_signals using gin (destinations);
create index if not exists idx_research_signals_topics_gin
  on public.research_signals using gin (topics);

-- -----------------------------------------------------------------------------
-- 3) research_evidence
-- -----------------------------------------------------------------------------
create table if not exists public.research_evidence (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.research_signals (id) on delete cascade,
  source_id uuid not null references public.research_sources (id) on delete restrict,
  url text,
  title text,
  excerpt text,
  reference text,
  published_at timestamptz,
  observed_at timestamptz not null,
  evidence_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_research_evidence_signal_id
  on public.research_evidence (signal_id);
create index if not exists idx_research_evidence_source_id
  on public.research_evidence (source_id);

-- -----------------------------------------------------------------------------
-- 4) research_briefs
-- -----------------------------------------------------------------------------
create table if not exists public.research_briefs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null,
  primary_signal_id uuid references public.research_signals (id) on delete set null,
  claims jsonb not null default '[]'::jsonb,
  topics text[] not null default '{}',
  destinations text[] not null default '{}',
  entities text[] not null default '{}',
  freshness jsonb not null,
  credibility jsonb not null,
  travel_relevance jsonb not null,
  public_interest numeric(4, 3) not null,
  commercial_relevance jsonb,
  risks jsonb not null default '[]'::jsonb,
  open_questions jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null,
  valid_until timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_research_briefs_status_generated
  on public.research_briefs (status, generated_at desc);

-- -----------------------------------------------------------------------------
-- 5) research_brief_signals (join)
-- -----------------------------------------------------------------------------
create table if not exists public.research_brief_signals (
  brief_id uuid not null references public.research_briefs (id) on delete cascade,
  signal_id uuid not null references public.research_signals (id) on delete cascade,
  primary key (brief_id, signal_id)
);

-- -----------------------------------------------------------------------------
-- 6) agenda_candidates
-- -----------------------------------------------------------------------------
create table if not exists public.agenda_candidates (
  id uuid primary key default gen_random_uuid(),
  research_brief_id uuid not null references public.research_briefs (id) on delete cascade,
  title text not null,
  rationale text not null,
  freshness_score numeric(4, 3) not null,
  public_interest_score numeric(4, 3) not null,
  travel_relevance_score numeric(4, 3) not null,
  credibility_score numeric(4, 3) not null,
  commercial_linkage_score numeric(4, 3),
  historical_duplication_score numeric(4, 3),
  seasonality_score numeric(4, 3),
  composite_research_score numeric(4, 3) not null,
  risk_flags jsonb not null default '[]'::jsonb,
  supporting_evidence_ids jsonb not null default '[]'::jsonb,
  status text not null default 'candidate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agenda_candidates_brief_id
  on public.agenda_candidates (research_brief_id);
create index if not exists idx_agenda_candidates_status_created
  on public.agenda_candidates (status, created_at desc);

create index if not exists idx_research_signals_source_external_id
  on public.research_signals (source_id, external_id)
  where external_id is not null;

-- -----------------------------------------------------------------------------
-- RLS (service role only — match social persistence pattern)
-- -----------------------------------------------------------------------------
alter table public.research_sources enable row level security;
alter table public.research_signals enable row level security;
alter table public.research_evidence enable row level security;
alter table public.research_briefs enable row level security;
alter table public.research_brief_signals enable row level security;
alter table public.agenda_candidates enable row level security;

create policy service_role_all_research_sources on public.research_sources
  for all to service_role using (true) with check (true);
create policy service_role_all_research_signals on public.research_signals
  for all to service_role using (true) with check (true);
create policy service_role_all_research_evidence on public.research_evidence
  for all to service_role using (true) with check (true);
create policy service_role_all_research_briefs on public.research_briefs
  for all to service_role using (true) with check (true);
create policy service_role_all_research_brief_signals on public.research_brief_signals
  for all to service_role using (true) with check (true);
create policy service_role_all_agenda_candidates on public.agenda_candidates
  for all to service_role using (true) with check (true);

revoke all on public.research_sources from anon, authenticated;
revoke all on public.research_signals from anon, authenticated;
revoke all on public.research_evidence from anon, authenticated;
revoke all on public.research_briefs from anon, authenticated;
revoke all on public.research_brief_signals from anon, authenticated;
revoke all on public.agenda_candidates from anon, authenticated;
