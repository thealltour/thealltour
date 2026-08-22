-- AI Marketing Department DB v1.
-- 기존 운영 테이블은 변경하지 않고, AI Marketing 전용 계층만 추가한다.
-- API(service_role / supabaseAdmin) 경유 전용.
--
-- 사전 확인:
--   최신 migration: 20260818183000
--   PostgreSQL: config.toml major_version = 17
--   pgvector: 기존 사용 없음 → create extension vector, embedding은 dimension 미지정
--   updated_at: 공통 trigger 없음 → 컬럼 default now()만 (kakao_moment 관례)
--   RLS: service_role_all_* + revoke anon/authenticated (kakao_moment 관례)
--   products.id: uuid. primary_product_id FK ON DELETE SET NULL
--   status/channel: CHECK·ENUM 없음 (기존 마케팅 테이블과 동일, application-level)

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- -----------------------------------------------------------------------------
-- 1) public.ai_campaigns
-- -----------------------------------------------------------------------------
create table if not exists public.ai_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  objective text,
  status text not null default 'draft',
  priority integer not null default 0,
  start_at timestamptz,
  end_at timestamptz,
  primary_product_id uuid references public.products (id) on delete set null,
  target_audience text,
  key_message text,
  policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_campaigns is
  'AI Marketing 캠페인/작전 단위. policy jsonb로 채널별 한도·쿨다운을 보관.';
comment on column public.ai_campaigns.primary_product_id is
  '대표 상품. public.products.id uuid FK.';
comment on column public.ai_campaigns.policy is
  '채널 정책 JSON. 예: { "threads": { "daily_max": 3, "agenda_cooldown_days": 7 } }.';

create index if not exists idx_ai_campaigns_status
  on public.ai_campaigns (status);
create index if not exists idx_ai_campaigns_priority
  on public.ai_campaigns (priority);
create index if not exists idx_ai_campaigns_start_at
  on public.ai_campaigns (start_at);
create index if not exists idx_ai_campaigns_end_at
  on public.ai_campaigns (end_at);
create index if not exists idx_ai_campaigns_primary_product_id
  on public.ai_campaigns (primary_product_id)
  where primary_product_id is not null;

-- -----------------------------------------------------------------------------
-- 2) public.ai_agendas
-- -----------------------------------------------------------------------------
create table if not exists public.ai_agendas (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.ai_campaigns (id) on delete set null,
  topic text not null,
  agenda_key text not null,
  angle text,
  target_audience text,
  intent text,
  first_used_at timestamptz,
  last_used_at timestamptz,
  usage_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_agendas is
  '콘텐츠 핵심 의제. 문장만 바꿔 반복하는 것을 막기 위한 de-dupe 축.';
comment on column public.ai_agendas.agenda_key is
  '의제 식별 키. 캠페인 내(또는 캠페인 없음)에서 unique.';

create unique index if not exists idx_ai_agendas_campaign_agenda_key
  on public.ai_agendas (campaign_id, agenda_key)
  where campaign_id is not null;
create unique index if not exists idx_ai_agendas_agenda_key_unassigned
  on public.ai_agendas (agenda_key)
  where campaign_id is null;
create index if not exists idx_ai_agendas_agenda_key
  on public.ai_agendas (agenda_key);
create index if not exists idx_ai_agendas_last_used_at
  on public.ai_agendas (last_used_at);
create index if not exists idx_ai_agendas_topic
  on public.ai_agendas (topic);

-- -----------------------------------------------------------------------------
-- 3) public.ai_contents  (Master Content)
-- -----------------------------------------------------------------------------
create table if not exists public.ai_contents (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.ai_campaigns (id) on delete set null,
  agenda_id uuid references public.ai_agendas (id) on delete set null,
  primary_product_id uuid references public.products (id) on delete set null,
  content_type text not null default 'master',
  title text,
  body text,
  hook text,
  cta text,
  target_audience text,
  tone text,
  status text not null default 'draft',
  content_hash text,
  normalized_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_contents is
  'AI Marketing Master Content. 채널별 파생은 ai_publications로 분리.';
comment on column public.ai_contents.content_hash is
  'Level 1 exact duplicate. NULL 허용, NOT NULL만 unique.';
comment on column public.ai_contents.normalized_hash is
  'Level 2 normalized duplicate. NULL 허용, NOT NULL만 unique.';

create unique index if not exists idx_ai_contents_content_hash
  on public.ai_contents (content_hash)
  where content_hash is not null;
create unique index if not exists idx_ai_contents_normalized_hash
  on public.ai_contents (normalized_hash)
  where normalized_hash is not null;
create index if not exists idx_ai_contents_campaign_id
  on public.ai_contents (campaign_id)
  where campaign_id is not null;
create index if not exists idx_ai_contents_agenda_id
  on public.ai_contents (agenda_id)
  where agenda_id is not null;
create index if not exists idx_ai_contents_primary_product_id
  on public.ai_contents (primary_product_id)
  where primary_product_id is not null;
create index if not exists idx_ai_contents_status
  on public.ai_contents (status);
create index if not exists idx_ai_contents_created_at
  on public.ai_contents (created_at desc);

-- -----------------------------------------------------------------------------
-- 4) public.ai_publications
-- -----------------------------------------------------------------------------
create table if not exists public.ai_publications (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.ai_contents (id) on delete cascade,
  channel text not null,
  external_post_id text,
  external_url text,
  status text not null default 'scheduled',
  scheduled_at timestamptz,
  published_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_publications is
  '채널 게시 이력. 동일 Master Content를 같은 채널에 재게시할 수 있으므로 (content_id, channel)은 unique가 아님.';
comment on column public.ai_publications.channel is
  'application-level. 예: threads, instagram, naver_blog, naver_band, kakao_channel, website.';

create unique index if not exists idx_ai_publications_channel_external_post_id
  on public.ai_publications (channel, external_post_id)
  where external_post_id is not null;
create index if not exists idx_ai_publications_content_channel
  on public.ai_publications (content_id, channel);
create index if not exists idx_ai_publications_channel_published_at
  on public.ai_publications (channel, published_at);
create index if not exists idx_ai_publications_channel_scheduled_at
  on public.ai_publications (channel, scheduled_at);

-- -----------------------------------------------------------------------------
-- 5) public.ai_feedback
-- -----------------------------------------------------------------------------
create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.ai_publications (id) on delete cascade,
  channel text not null,
  metric_type text not null,
  metric_value numeric not null default 0,
  measured_at timestamptz not null default now(),
  raw_data jsonb,
  created_at timestamptz not null default now()
);

comment on table public.ai_feedback is
  '게시 이후 시장 반응 통합. metric_type은 플랫폼별로 다르므로 text.';
comment on column public.ai_feedback.metric_type is
  '예: views, likes, comments, shares, clicks, reach, ctr, conversions, inquiries, bookings, revenue.';

create index if not exists idx_ai_feedback_publication_id
  on public.ai_feedback (publication_id);
create index if not exists idx_ai_feedback_channel
  on public.ai_feedback (channel);
create index if not exists idx_ai_feedback_metric_type
  on public.ai_feedback (metric_type);
create index if not exists idx_ai_feedback_measured_at
  on public.ai_feedback (measured_at);

-- -----------------------------------------------------------------------------
-- 6) public.ai_memory
-- -----------------------------------------------------------------------------
create table if not exists public.ai_memory (
  id uuid primary key default gen_random_uuid(),
  memory_type text not null,
  title text,
  content text not null,
  source_type text,
  source_id text,
  importance numeric,
  confidence numeric,
  embedding_model text,
  embedding vector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

comment on table public.ai_memory is
  'AI Marketing 장기 기억. embedding dimension은 미확정(vector typmod 없음). HNSW/IVFFlat는 후속 migration.';
comment on column public.ai_memory.memory_type is
  '예: customer_insight, market_insight, performance_insight, governance, brand_knowledge, content_knowledge, trend.';
comment on column public.ai_memory.embedding is
  'pgvector. dimension 미지정. 모델 확정 후 별도 migration에서 typmod·index 추가.';

create index if not exists idx_ai_memory_memory_type
  on public.ai_memory (memory_type);
create index if not exists idx_ai_memory_source
  on public.ai_memory (source_type, source_id)
  where source_type is not null;
create index if not exists idx_ai_memory_created_at
  on public.ai_memory (created_at desc);

-- -----------------------------------------------------------------------------
-- 7) public.ai_runs
-- -----------------------------------------------------------------------------
create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  task_type text not null,
  status text not null default 'running',
  input_context jsonb,
  output_summary jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  model text,
  provider text,
  error_message text,
  created_at timestamptz not null default now()
);

comment on table public.ai_runs is
  'Hermes Bot 실행/판단 기록. 예: trend_scout, content_creator, content_governance.';

create index if not exists idx_ai_runs_agent_name
  on public.ai_runs (agent_name);
create index if not exists idx_ai_runs_task_type
  on public.ai_runs (task_type);
create index if not exists idx_ai_runs_status
  on public.ai_runs (status);
create index if not exists idx_ai_runs_started_at
  on public.ai_runs (started_at desc);

-- -----------------------------------------------------------------------------
-- RLS: service_role 전용 (kakao_moment 패턴)
-- -----------------------------------------------------------------------------
alter table public.ai_campaigns enable row level security;
alter table public.ai_agendas enable row level security;
alter table public.ai_contents enable row level security;
alter table public.ai_publications enable row level security;
alter table public.ai_feedback enable row level security;
alter table public.ai_memory enable row level security;
alter table public.ai_runs enable row level security;

drop policy if exists service_role_all_ai_campaigns on public.ai_campaigns;
create policy service_role_all_ai_campaigns
  on public.ai_campaigns for all to service_role using (true) with check (true);

drop policy if exists service_role_all_ai_agendas on public.ai_agendas;
create policy service_role_all_ai_agendas
  on public.ai_agendas for all to service_role using (true) with check (true);

drop policy if exists service_role_all_ai_contents on public.ai_contents;
create policy service_role_all_ai_contents
  on public.ai_contents for all to service_role using (true) with check (true);

drop policy if exists service_role_all_ai_publications on public.ai_publications;
create policy service_role_all_ai_publications
  on public.ai_publications for all to service_role using (true) with check (true);

drop policy if exists service_role_all_ai_feedback on public.ai_feedback;
create policy service_role_all_ai_feedback
  on public.ai_feedback for all to service_role using (true) with check (true);

drop policy if exists service_role_all_ai_memory on public.ai_memory;
create policy service_role_all_ai_memory
  on public.ai_memory for all to service_role using (true) with check (true);

drop policy if exists service_role_all_ai_runs on public.ai_runs;
create policy service_role_all_ai_runs
  on public.ai_runs for all to service_role using (true) with check (true);

revoke all on public.ai_campaigns from anon, authenticated;
revoke all on public.ai_agendas from anon, authenticated;
revoke all on public.ai_contents from anon, authenticated;
revoke all on public.ai_publications from anon, authenticated;
revoke all on public.ai_feedback from anon, authenticated;
revoke all on public.ai_memory from anon, authenticated;
revoke all on public.ai_runs from anon, authenticated;

grant all on public.ai_campaigns to service_role;
grant all on public.ai_agendas to service_role;
grant all on public.ai_contents to service_role;
grant all on public.ai_publications to service_role;
grant all on public.ai_feedback to service_role;
grant all on public.ai_memory to service_role;
grant all on public.ai_runs to service_role;
