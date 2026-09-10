-- SV-6: Durable Shortform VideoRenderJob (orchestration state only).
-- Attaches to CompletedMarketingCandidate. Explicit enqueue only.
-- Does NOT download stock, call Fal/Remotion/FFmpeg, or run Mini-PC workers.
-- Additive after 20260911050000_marketing_media_sources.sql.
-- DO NOT apply in this coding step unless a dedicated acceptance run is authorized.

create table if not exists public.shortform_video_render_jobs (
  id uuid primary key default gen_random_uuid(),
  job_id text not null
    constraint shortform_video_render_jobs_job_id_check
      check (char_length(job_id) between 1 and 128 and job_id !~ '[[:cntrl:]]'),
  logical_run_key text not null
    constraint shortform_video_render_jobs_logical_run_key_check
      check (char_length(logical_run_key) between 1 and 256 and logical_run_key !~ '[[:cntrl:]]'),

  candidate_id text not null
    constraint shortform_video_render_jobs_candidate_id_check
      check (char_length(candidate_id) between 1 and 128 and candidate_id !~ '[[:cntrl:]]'),
  production_request_id text
    constraint shortform_video_render_jobs_production_request_id_check
      check (
        production_request_id is null
        or (
          char_length(production_request_id) between 1 and 128
          and production_request_id !~ '[[:cntrl:]]'
        )
      ),
  business_date_kst text not null
    constraint shortform_video_render_jobs_business_date_check
      check (business_date_kst ~ '^\d{4}-\d{2}-\d{2}$'),

  status text not null
    constraint shortform_video_render_jobs_status_check
      check (status in ('QUEUED', 'RUNNING', 'READY', 'FAILED', 'CANCELLED')),

  short_video_brief_artifact_path text not null
    constraint shortform_video_render_jobs_brief_path_check
      check (
        short_video_brief_artifact_path !~ '^/'
        and short_video_brief_artifact_path !~ '\.\.'
        and char_length(short_video_brief_artifact_path) between 1 and 512
      ),
  source_resolution_artifact_path text
    constraint shortform_video_render_jobs_resolution_path_check
      check (
        source_resolution_artifact_path is null
        or (
          source_resolution_artifact_path !~ '^/'
          and source_resolution_artifact_path !~ '\.\.'
          and char_length(source_resolution_artifact_path) between 1 and 512
        )
      ),
  render_profile text not null default 'shortform_vertical_v1'
    constraint shortform_video_render_jobs_profile_check
      check (char_length(render_profile) between 1 and 64),

  -- Small identity snapshot only (hashes + scene→sourceIds). Never full brief / secrets.
  input_snapshot jsonb not null default '{}'::jsonb,

  attempt_count integer not null default 0
    constraint shortform_video_render_jobs_attempt_nonneg check (attempt_count >= 0),
  max_attempts integer not null default 3
    constraint shortform_video_render_jobs_max_attempts_pos check (max_attempts >= 1),

  claimed_by text
    constraint shortform_video_render_jobs_claimed_by_check
      check (claimed_by is null or (char_length(claimed_by) between 1 and 128)),
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  claim_token text,
  next_attempt_at timestamptz,

  output_artifact_path text
    constraint shortform_video_render_jobs_output_path_check
      check (
        output_artifact_path is null
        or (
          output_artifact_path !~ '^/'
          and output_artifact_path !~ '\.\.'
          and char_length(output_artifact_path) between 1 and 512
        )
      ),
  error_code text
    constraint shortform_video_render_jobs_error_code_len
      check (error_code is null or char_length(error_code) between 1 and 64),
  error_summary text
    constraint shortform_video_render_jobs_error_summary_len
      check (error_summary is null or char_length(error_summary) <= 400),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.shortform_video_render_jobs is
  'SV-6 durable shortform VideoRenderJob. Orchestration state only — not the rendered file.';
comment on column public.shortform_video_render_jobs.logical_run_key is
  'Idempotency key: candidate + brief sha + selection hash + render profile.';
comment on column public.shortform_video_render_jobs.input_snapshot is
  'Compact input identity (hashes + scene picks). No binaries / secrets / full brief.';
comment on column public.shortform_video_render_jobs.claimed_by is
  'Non-sensitive worker identifier. Never hostname-bound scheduling policy.';
comment on column public.shortform_video_render_jobs.output_artifact_path is
  'Package-relative durable final path. mark READY only after durable persist (worker invariant).';

create unique index if not exists uq_shortform_video_render_jobs_logical_run_key
  on public.shortform_video_render_jobs (logical_run_key);

create unique index if not exists uq_shortform_video_render_jobs_job_id
  on public.shortform_video_render_jobs (job_id);

create index if not exists idx_shortform_video_render_jobs_candidate
  on public.shortform_video_render_jobs (candidate_id, created_at desc);

create index if not exists idx_shortform_video_render_jobs_status_created
  on public.shortform_video_render_jobs (status, created_at);

create index if not exists idx_shortform_video_render_jobs_claimable
  on public.shortform_video_render_jobs (status, created_at)
  where status in ('QUEUED', 'RUNNING');

alter table public.shortform_video_render_jobs enable row level security;

drop policy if exists service_role_all_shortform_video_render_jobs
  on public.shortform_video_render_jobs;
create policy service_role_all_shortform_video_render_jobs
  on public.shortform_video_render_jobs
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.shortform_video_render_jobs from anon, authenticated;
grant all on public.shortform_video_render_jobs to service_role;

-- Atomic claim: one QUEUED (due) or stale RUNNING (lease expired, attempts remaining).
create or replace function public.claim_shortform_video_render_job(
  p_worker_id text,
  p_lease_ms bigint default 1800000,
  p_now timestamptz default now()
)
returns public.shortform_video_render_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.shortform_video_render_jobs%rowtype;
  v_worker text := nullif(trim(coalesce(p_worker_id, '')), '');
  v_claim_token text := gen_random_uuid()::text;
  v_attempt integer;
  v_lease_ms bigint := greatest(coalesce(p_lease_ms, 1800000), 1000);
begin
  if v_worker is null then
    raise exception 'WORKER_ID_REQUIRED';
  end if;

  select *
  into v_row
  from public.shortform_video_render_jobs
  where
    attempt_count < max_attempts
    and (
      (
        status = 'QUEUED'
        and coalesce(next_attempt_at, '-infinity'::timestamptz) <= p_now
      )
      or (
        status = 'RUNNING'
        and lease_expires_at is not null
        and lease_expires_at < p_now
      )
    )
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  v_attempt := coalesce(v_row.attempt_count, 0) + 1;
  if v_attempt > v_row.max_attempts then
    return null;
  end if;

  update public.shortform_video_render_jobs
  set
    status = 'RUNNING',
    claimed_by = v_worker,
    claimed_at = p_now,
    lease_expires_at = p_now + make_interval(secs => v_lease_ms / 1000.0),
    claim_token = v_claim_token,
    attempt_count = v_attempt,
    next_attempt_at = null,
    error_code = null,
    error_summary = null,
    updated_at = p_now
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.claim_shortform_video_render_job(text, bigint, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_shortform_video_render_job(text, bigint, timestamptz)
  to service_role;

comment on function public.claim_shortform_video_render_job(text, bigint, timestamptz) is
  'Atomically claim one QUEUED or stale-lease RUNNING shortform VideoRenderJob (SKIP LOCKED).';

create or replace function public.finalize_shortform_video_render_job_ready(
  p_logical_run_key text,
  p_output_artifact_path text,
  p_claim_token text,
  p_attempt_count integer,
  p_claimed_by text,
  p_now timestamptz default now()
)
returns public.shortform_video_render_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.shortform_video_render_jobs%rowtype;
  v_path text := nullif(trim(coalesce(p_output_artifact_path, '')), '');
begin
  if v_path is null then
    raise exception 'OUTPUT_ARTIFACT_PATH_REQUIRED';
  end if;

  update public.shortform_video_render_jobs
  set
    status = 'READY',
    output_artifact_path = v_path,
    completed_at = p_now,
    lease_expires_at = null,
    error_code = null,
    error_summary = null,
    updated_at = p_now
  where logical_run_key = p_logical_run_key
    and status = 'RUNNING'
    and claim_token = p_claim_token
    and attempt_count = p_attempt_count
    and claimed_by = p_claimed_by
  returning * into v_row;

  if not found then
    return null;
  end if;
  return v_row;
end;
$$;

revoke all on function public.finalize_shortform_video_render_job_ready(text, text, text, integer, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.finalize_shortform_video_render_job_ready(text, text, text, integer, text, timestamptz)
  to service_role;

create or replace function public.finalize_shortform_video_render_job_failed(
  p_logical_run_key text,
  p_error_code text,
  p_error_summary text,
  p_claim_token text,
  p_attempt_count integer,
  p_claimed_by text,
  p_now timestamptz default now()
)
returns public.shortform_video_render_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.shortform_video_render_jobs%rowtype;
  v_code text := left(nullif(trim(coalesce(p_error_code, 'RENDER_FAILED')), ''), 64);
  v_summary text := left(coalesce(p_error_summary, 'unknown_error'), 400);
begin
  update public.shortform_video_render_jobs
  set
    status = 'FAILED',
    completed_at = null,
    lease_expires_at = null,
    error_code = v_code,
    error_summary = v_summary,
    updated_at = p_now
  where logical_run_key = p_logical_run_key
    and status = 'RUNNING'
    and claim_token = p_claim_token
    and attempt_count = p_attempt_count
    and claimed_by = p_claimed_by
  returning * into v_row;

  if not found then
    return null;
  end if;
  return v_row;
end;
$$;

revoke all on function public.finalize_shortform_video_render_job_failed(text, text, text, text, integer, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.finalize_shortform_video_render_job_failed(text, text, text, text, integer, text, timestamptz)
  to service_role;
