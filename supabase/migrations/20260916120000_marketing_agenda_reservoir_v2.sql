-- AGENDA_QUALITY_V2 Phase 2 — durable Agenda Reservoir (additive, shadow-ready).
-- Does NOT rename/alter V1 agenda slate tables.

create table if not exists public.marketing_agenda_reservoir_v2 (
  agenda_id text primary key,
  lifecycle_status text not null
    check (lifecycle_status in (
      'QUALIFIED', 'PRESENTED', 'SELECTED', 'DEFERRED', 'REJECTED', 'EXPIRED', 'SUPERSEDED'
    )),
  freshness_class text not null
    check (freshness_class in ('breaking', 'timely', 'seasonal', 'evergreen')),
  expires_at timestamptz null,
  source_fingerprint text not null,
  topic_fingerprint text null,
  decision_axis_fingerprint text null,
  story_seed_fingerprint text null,
  semantic_fingerprint text null,
  first_qualified_at timestamptz not null,
  last_presented_at timestamptz null,
  presented_count integer not null default 0,
  selected_at timestamptz null,
  deferred_at timestamptz null,
  rejected_at timestamptz null,
  expired_at timestamptz null,
  superseded_by_agenda_id text null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  seen_count integer not null default 1,
  last_slate_at timestamptz null,
  last_selected_at timestamptz null,
  last_rejected_at timestamptz null,
  candidate_version integer not null default 1,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.marketing_agenda_reservoir_v2 is
  'AGENDA_QUALITY_V2 durable reservoir for shadow/production-grade memory. Additive; V1 slates untouched.';

create index if not exists idx_mag_reservoir_v2_status_seen
  on public.marketing_agenda_reservoir_v2 (lifecycle_status, last_seen_at desc);

create index if not exists idx_mag_reservoir_v2_topic
  on public.marketing_agenda_reservoir_v2 (topic_fingerprint, last_seen_at desc);

create index if not exists idx_mag_reservoir_v2_decision_axis
  on public.marketing_agenda_reservoir_v2 (decision_axis_fingerprint, last_seen_at desc);

create index if not exists idx_mag_reservoir_v2_story_seed
  on public.marketing_agenda_reservoir_v2 (story_seed_fingerprint, last_seen_at desc);

alter table public.marketing_agenda_reservoir_v2 enable row level security;
-- Service-role only (no anon/authenticated policies) — marketing research pattern.
