-- Marketing semantic entity embeddings (STEP E-1 / E-1F).
-- Durable, model-revision-aware storage for research_brief / agenda_candidate /
-- completed_marketing_candidate. Does NOT alter Agenda ranking or production flows.
--
-- Separate from public.ai_memory (long-term memory retrieval).
-- Cosine similarity = 1 - (embedding <=> query) in [-1, 1]. Higher = more similar.
-- Assumes BAAI/bge-m3 normalize_embeddings=true dense vectors (vector(1024)).
--
-- Uniqueness preserves both embedding pipeline revision and canonical text schema:
--   (entity_type, entity_id, embedding_model, embedding_revision, source_text_version)

create extension if not exists vector;

create table if not exists public.marketing_semantic_embeddings (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null
    check (entity_type in ('research_brief', 'agenda_candidate', 'completed_marketing_candidate')),
  entity_id text not null,
  embedding_model text not null,
  embedding_dimension integer not null check (embedding_dimension = 1024),
  -- Explicit pipeline/model-config revision (text). Never infer "latest" via lexical max.
  embedding_revision text not null check (char_length(btrim(embedding_revision)) > 0),
  content_hash text not null
    check (content_hash ~ '^[a-f0-9]{64}$'),
  -- Canonical text schema revision (distinct from embedding_revision).
  source_text_version text not null check (char_length(btrim(source_text_version)) > 0),
  embedding vector(1024) not null,
  metadata jsonb not null default '{}'::jsonb,
  embedded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_semantic_embeddings_entity_identity_uniq
    unique (
      entity_type,
      entity_id,
      embedding_model,
      embedding_revision,
      source_text_version
    )
);

comment on table public.marketing_semantic_embeddings is
  'Model/text-schema-aware semantic embeddings. Unique per (entity_type, entity_id, embedding_model, embedding_revision, source_text_version). Lookups must pass explicit revision + source_text_version.';

comment on column public.marketing_semantic_embeddings.embedding is
  'pgvector vector(1024) dense embedding (BAAI/bge-m3 normalized). Cosine HNSW: idx_marketing_semantic_embeddings_embedding_hnsw.';

comment on column public.marketing_semantic_embeddings.embedding_revision is
  'Embedding pipeline/model-configuration revision identity (text). Not ordered lexicographically for "latest".';

comment on column public.marketing_semantic_embeddings.source_text_version is
  'Canonical source-text schema version (e.g. v1). Independent from embedding_revision.';

comment on column public.marketing_semantic_embeddings.content_hash is
  'SHA-256 hex of canonical source text + source_text_version identity.';

create index if not exists idx_marketing_semantic_embeddings_entity
  on public.marketing_semantic_embeddings (entity_type, entity_id);

create index if not exists idx_marketing_semantic_embeddings_model_revision_text
  on public.marketing_semantic_embeddings (embedding_model, embedding_revision, source_text_version);

create index if not exists idx_marketing_semantic_embeddings_embedding_hnsw
  on public.marketing_semantic_embeddings
  using hnsw (embedding vector_cosine_ops);

create or replace function public.match_marketing_semantic_embeddings(
  query_embedding vector(1024),
  match_count integer default 20,
  min_similarity double precision default -1,
  filter_entity_type text default null,
  filter_embedding_model text default null,
  filter_embedding_revision text default null,
  filter_source_text_version text default null,
  exclude_entity_ids text[] default null
)
returns table (
  id uuid,
  entity_type text,
  entity_id text,
  embedding_model text,
  embedding_dimension integer,
  embedding_revision text,
  content_hash text,
  source_text_version text,
  metadata jsonb,
  embedded_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  similarity double precision
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_limit integer;
begin
  v_limit := greatest(1, least(coalesce(match_count, 20), 100));

  if filter_entity_type is not null
     and filter_entity_type not in (
       'research_brief',
       'agenda_candidate',
       'completed_marketing_candidate'
     ) then
    raise exception 'invalid filter_entity_type: %', filter_entity_type;
  end if;

  if min_similarity < -1 or min_similarity > 1 then
    raise exception 'min_similarity must be within [-1, 1], got %', min_similarity;
  end if;

  return query
  select
    e.id,
    e.entity_type,
    e.entity_id,
    e.embedding_model,
    e.embedding_dimension,
    e.embedding_revision,
    e.content_hash,
    e.source_text_version,
    e.metadata,
    e.embedded_at,
    e.created_at,
    e.updated_at,
    (1 - (e.embedding <=> query_embedding))::double precision as similarity
  from public.marketing_semantic_embeddings as e
  where (filter_entity_type is null or e.entity_type = filter_entity_type)
    and (filter_embedding_model is null or e.embedding_model = filter_embedding_model)
    and (filter_embedding_revision is null or e.embedding_revision = filter_embedding_revision)
    and (filter_source_text_version is null or e.source_text_version = filter_source_text_version)
    and (
      exclude_entity_ids is null
      or cardinality(exclude_entity_ids) = 0
      or e.entity_id <> all (exclude_entity_ids)
    )
    and (e.embedding <=> query_embedding) <= (1.0 - min_similarity)
  order by e.embedding <=> query_embedding asc
  limit v_limit;
end;
$$;

comment on function public.match_marketing_semantic_embeddings(vector, integer, double precision, text, text, text, text, text[]) is
  'Marketing entity semantic search. Cosine similarity = 1 - (embedding <=> query) in [-1,1]. Explicit model/revision/source_text_version filters. service_role only.';

revoke all on function public.match_marketing_semantic_embeddings(vector, integer, double precision, text, text, text, text, text[])
  from public, anon, authenticated;

grant execute on function public.match_marketing_semantic_embeddings(vector, integer, double precision, text, text, text, text, text[])
  to service_role;

alter table public.marketing_semantic_embeddings enable row level security;

-- No anon/authenticated policies: service_role bypasses RLS for server-side repos.
