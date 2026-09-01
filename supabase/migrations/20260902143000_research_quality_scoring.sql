-- STEP 3-3: Research quality scoring + corroboration metadata.
-- Does not modify prior applied migration.

alter table if exists public.research_briefs
  add column if not exists cluster_id uuid,
  add column if not exists corroboration jsonb;

alter table if exists public.agenda_candidates
  add column if not exists corroboration_score numeric(4, 3),
  add column if not exists research_score_components jsonb,
  add column if not exists score_reasons jsonb;

create index if not exists idx_research_briefs_cluster_id
  on public.research_briefs (cluster_id)
  where cluster_id is not null;

comment on column public.research_briefs.corroboration is
  'Cross-source corroboration assessment (not governance decision).';
comment on column public.agenda_candidates.research_score_components is
  'Explainable calibrated component scores for research ranking (not MM final priority).';
