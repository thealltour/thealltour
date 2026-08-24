-- AI Marketing STEP 1-6: ai_memory vector(1024) + cosine HNSW + match_ai_memory RPC.
--
-- Source of truth: supabase/migrations/20260822110700_ai_marketing_v1.sql
-- Actual public.ai_memory columns (do not invent missing ones):
--   id uuid PK
--   memory_type text not null
--   title text
--   content text not null
--   source_type text
--   source_id text
--   importance numeric
--   confidence numeric
--   embedding_model text
--   embedding vector          -- unbounded; this migration sets vector(1024)
--   created_at timestamptz not null
--   updated_at timestamptz not null
--   expires_at timestamptz
--
-- Not present (not added): campaign_id, agenda_id, product_id, source, metadata jsonb.
-- Product/campaign identity today is source_type + source_id when used that way.
--
-- Scope: extension check, embedding typmod, HNSW index, search function, grants.
-- No UPDATE/DELETE of ai_memory rows. No backfill. No website table ALTER.

create extension if not exists vector;

-- -----------------------------------------------------------------------------
-- 1) Fail clearly if any stored embedding is not 1024-d.
--    Do not UPDATE, DELETE, truncate, or silently recast those rows.
-- -----------------------------------------------------------------------------
do $$
declare
  mismatch_count integer;
begin
  select count(*)
    into mismatch_count
  from public.ai_memory
  where embedding is not null
    and vector_dims(embedding) is distinct from 1024;

  if mismatch_count > 0 then
    raise exception
      'ai_memory.embedding cannot become vector(1024): % non-null row(s) have a different dimension. Inspect those rows; this migration does not UPDATE or DELETE them.',
      mismatch_count;
  end if;
end
$$;

alter table public.ai_memory
  alter column embedding type vector(1024)
  using embedding::vector(1024);

comment on column public.ai_memory.embedding is
  'pgvector vector(1024) for BAAI/bge-m3 (normalize_embeddings=true). Cosine HNSW: idx_ai_memory_embedding_hnsw.';

-- -----------------------------------------------------------------------------
-- 2) Cosine HNSW. Existing index names use idx_ai_memory_*.
--    Default m / ef_construction (no premature tuning).
-- -----------------------------------------------------------------------------
create index if not exists idx_ai_memory_embedding_hnsw
  on public.ai_memory
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

-- -----------------------------------------------------------------------------
-- 3) Semantic search RPC — service_role only, SECURITY INVOKER.
--    match_count is clamped to [1, 100] (search RPC should not fail callers).
--    min_similarity <= 0 skips the distance predicate so ANN top-K stays index-friendly.
--    min_similarity > 0 uses (embedding <=> query) <= (1 - min_similarity).
-- -----------------------------------------------------------------------------
create or replace function public.match_ai_memory(
  query_embedding vector(1024),
  match_count integer default 20,
  min_similarity double precision default 0,
  filter_memory_type text default null,
  filter_source_type text default null,
  filter_source_id text default null,
  filter_embedding_model text default null
)
returns table (
  id uuid,
  memory_type text,
  title text,
  content text,
  source_type text,
  source_id text,
  importance numeric,
  confidence numeric,
  embedding_model text,
  created_at timestamptz,
  updated_at timestamptz,
  expires_at timestamptz,
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

  return query
  select
    m.id,
    m.memory_type,
    m.title,
    m.content,
    m.source_type,
    m.source_id,
    m.importance,
    m.confidence,
    m.embedding_model,
    m.created_at,
    m.updated_at,
    m.expires_at,
    (1 - (m.embedding <=> query_embedding))::double precision as similarity
  from public.ai_memory as m
  where m.embedding is not null
    and (m.expires_at is null or m.expires_at > now())
    and (filter_memory_type is null or m.memory_type = filter_memory_type)
    and (filter_source_type is null or m.source_type = filter_source_type)
    and (filter_source_id is null or m.source_id = filter_source_id)
    and (filter_embedding_model is null or m.embedding_model = filter_embedding_model)
    and (
      min_similarity <= 0
      or (m.embedding <=> query_embedding) <= (1.0 - min_similarity)
    )
  order by m.embedding <=> query_embedding asc
  limit v_limit;
end;
$$;

comment on function public.match_ai_memory(vector, integer, double precision, text, text, text, text) is
  'AI Marketing semantic memory search. Cosine similarity = 1 - (embedding <=> query). service_role RPC only. Filter mixed embedding_model values in the caller; do not mix BAAI/bge-m3 with other models.';

revoke all on function public.match_ai_memory(vector, integer, double precision, text, text, text, text)
  from public, anon, authenticated;

grant execute on function public.match_ai_memory(vector, integer, double precision, text, text, text, text)
  to service_role;

-- -----------------------------------------------------------------------------
-- Verification (run after apply; do not paste a 1024-d literal here)
--
-- Dimension typmod (unbounded vector is -1; vector(1024) is 1024 in pgvector):
--   select attname, atttypmod
--   from pg_attribute
--   where attrelid = 'public.ai_memory'::regclass
--     and attname = 'embedding'
--     and not attisdropped;
--
-- Indexes:
--   select indexname, indexdef
--   from pg_indexes
--   where schemaname = 'public' and tablename = 'ai_memory';
--
-- Function:
--   select p.proname, pg_get_function_identity_arguments(p.oid) as args,
--          pg_get_function_result(p.oid) as result
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'match_ai_memory';
--
-- Grants:
--   select grantee, privilege_type
--   from information_schema.routine_privileges
--   where routine_schema = 'public' and routine_name = 'match_ai_memory';
--
-- Smoke search without a hardcoded 1024-d literal:
--   select id, similarity
--   from public.match_ai_memory(
--     (select embedding from public.ai_memory where embedding is not null limit 1),
--     5, 0, null, null, null, 'BAAI/bge-m3'
--   );
--   -- returns no rows if no stored embedding exists yet (expected before ingestion).
-- -----------------------------------------------------------------------------
