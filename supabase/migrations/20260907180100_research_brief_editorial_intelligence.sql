-- T-6: Research brief editorial intelligence + trend context (separated from facts/evidence).

alter table public.research_briefs
  add column if not exists editorial_intelligence jsonb null;

alter table public.research_briefs
  add column if not exists trend_context jsonb null;

alter table public.research_briefs
  add column if not exists market_relevance_signals jsonb null;

comment on column public.research_briefs.editorial_intelligence is
  'Editorial intelligence layer (hooks/formats/angles) — never mixed into verified facts.';

comment on column public.research_briefs.trend_context is
  'Trend discovery provenance/context from TrendSourceAdapter (Meta). Diagnostics only.';

comment on column public.research_briefs.market_relevance_signals is
  'Provider market-relevance input features. Not a direct koreanTravelerRelevance copy.';
