-- STEP G-7: Additive execution metadata + atomic claim / ownership-CAS finalize.
-- Does not mutate historical CompletedMarketingCandidate / HumanMarketingReview rows.
-- Does not change QUEUED payload semantics from G-5.

alter table public.daily_marketing_production_requests
  add column if not exists claimed_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists claim_token text,
  add column if not exists last_error text,
  add column if not exists worker_id text;

comment on column public.daily_marketing_production_requests.claimed_at is
  'When a worker atomically claimed QUEUED→RUNNING (or reclaimed stale RUNNING).';
comment on column public.daily_marketing_production_requests.claim_token is
  'Opaque ownership token minted per claim; finalize must CAS on this token.';
comment on column public.daily_marketing_production_requests.worker_id is
  'Non-sensitive worker identifier only. Never secrets.';

create index if not exists idx_daily_marketing_production_requests_claimable
  on public.daily_marketing_production_requests (status, created_at)
  where status in ('QUEUED', 'RUNNING');

-- Atomic claim: one row QUEUED (or stale RUNNING) → RUNNING.
-- Uses FOR UPDATE SKIP LOCKED so concurrent workers cannot claim the same row.
create or replace function public.claim_daily_marketing_production_request(
  p_worker_id text,
  p_stale_after_ms bigint default 1800000,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.daily_marketing_production_requests%rowtype;
  v_payload jsonb;
  v_stale_before timestamptz := p_now - make_interval(secs => greatest(p_stale_after_ms, 0) / 1000.0);
  v_worker text := nullif(trim(coalesce(p_worker_id, '')), '');
  v_claim_token text := gen_random_uuid()::text;
  v_attempt integer;
begin
  if v_worker is null then
    raise exception 'WORKER_ID_REQUIRED';
  end if;

  select *
  into v_row
  from public.daily_marketing_production_requests
  where
    status = 'QUEUED'
    or (
      status = 'RUNNING'
      and coalesce(claimed_at, started_at, updated_at) < v_stale_before
    )
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  v_attempt := coalesce(v_row.attempt_count, 0) + 1;
  v_payload := coalesce(v_row.payload, '{}'::jsonb);
  v_payload := jsonb_set(v_payload, '{status}', to_jsonb('RUNNING'::text), true);
  v_payload := jsonb_set(v_payload, '{claimedAt}', to_jsonb(p_now), true);
  v_payload := jsonb_set(v_payload, '{startedAt}', to_jsonb(p_now), true);
  v_payload := jsonb_set(v_payload, '{workerId}', to_jsonb(v_worker), true);
  v_payload := jsonb_set(v_payload, '{claimToken}', to_jsonb(v_claim_token), true);
  v_payload := jsonb_set(v_payload, '{attemptCount}', to_jsonb(v_attempt), true);
  v_payload := jsonb_set(v_payload, '{updatedAt}', to_jsonb(p_now), true);
  v_payload := jsonb_set(v_payload, '{lastError}', 'null'::jsonb, true);
  v_payload := jsonb_set(v_payload, '{errorMessage}', 'null'::jsonb, true);

  update public.daily_marketing_production_requests
  set
    status = 'RUNNING',
    claimed_at = p_now,
    started_at = p_now,
    attempt_count = v_attempt,
    claim_token = v_claim_token,
    worker_id = v_worker,
    last_error = null,
    payload = v_payload,
    updated_at = p_now
  where id = v_row.id
  returning * into v_row;

  return v_row.payload;
end;
$$;

revoke all on function public.claim_daily_marketing_production_request(text, bigint, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_daily_marketing_production_request(text, bigint, timestamptz)
  to service_role;

comment on function public.claim_daily_marketing_production_request(text, bigint, timestamptz) is
  'Atomically claim one QUEUED (or stale RUNNING) marketing production request for a Pi worker.';

-- Ownership-CAS finalize: COMPLETED only if claim still owned by caller.
create or replace function public.finalize_daily_marketing_production_request_completed(
  p_logical_run_key text,
  p_completed_candidate_id text,
  p_claim_token text,
  p_attempt_count integer,
  p_worker_id text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.daily_marketing_production_requests%rowtype;
  v_payload jsonb;
begin
  update public.daily_marketing_production_requests
  set
    status = 'COMPLETED',
    completed_at = p_now,
    failed_at = null,
    last_error = null,
    payload = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(coalesce(payload, '{}'::jsonb), '{status}', to_jsonb('COMPLETED'::text), true),
            '{completedAt}', to_jsonb(p_now), true
          ),
          '{failedAt}', 'null'::jsonb, true
        ),
        '{completedCandidateId}', to_jsonb(p_completed_candidate_id), true
      ),
      '{updatedAt}', to_jsonb(p_now), true
    ),
    updated_at = p_now
  where logical_run_key = p_logical_run_key
    and status = 'RUNNING'
    and claim_token = p_claim_token
    and attempt_count = p_attempt_count
    and worker_id = p_worker_id
  returning * into v_row;

  if not found then
    return null;
  end if;
  return v_row.payload;
end;
$$;

revoke all on function public.finalize_daily_marketing_production_request_completed(text, text, text, integer, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.finalize_daily_marketing_production_request_completed(text, text, text, integer, text, timestamptz)
  to service_role;

create or replace function public.finalize_daily_marketing_production_request_failed(
  p_logical_run_key text,
  p_last_error text,
  p_claim_token text,
  p_attempt_count integer,
  p_worker_id text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.daily_marketing_production_requests%rowtype;
  v_err text := left(coalesce(p_last_error, 'unknown_error'), 400);
begin
  update public.daily_marketing_production_requests
  set
    status = 'FAILED',
    failed_at = p_now,
    completed_at = null,
    last_error = v_err,
    payload = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(coalesce(payload, '{}'::jsonb), '{status}', to_jsonb('FAILED'::text), true),
              '{failedAt}', to_jsonb(p_now), true
            ),
            '{completedAt}', 'null'::jsonb, true
          ),
          '{lastError}', to_jsonb(v_err), true
        ),
        '{errorMessage}', to_jsonb(v_err), true
      ),
      '{updatedAt}', to_jsonb(p_now), true
    ),
    updated_at = p_now
  where logical_run_key = p_logical_run_key
    and status = 'RUNNING'
    and claim_token = p_claim_token
    and attempt_count = p_attempt_count
    and worker_id = p_worker_id
  returning * into v_row;

  if not found then
    return null;
  end if;
  return v_row.payload;
end;
$$;

revoke all on function public.finalize_daily_marketing_production_request_failed(text, text, text, integer, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.finalize_daily_marketing_production_request_failed(text, text, text, integer, text, timestamptz)
  to service_role;
