-- SV-8C4-E: align claim_shortform_video_render_job lease default with app (45m).
-- Production worker always passes p_lease_ms explicitly; this closes the SQL fallback.
-- Claim semantics unchanged (SKIP LOCKED, QUEUED/stale RUNNING only).

create or replace function public.claim_shortform_video_render_job(
  p_worker_id text,
  p_lease_ms bigint default 2700000,
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
  v_lease_ms bigint := greatest(coalesce(p_lease_ms, 2700000), 1000);
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
  'Atomically claim one QUEUED or stale-lease RUNNING shortform VideoRenderJob (SKIP LOCKED). Default lease 45m (2700000ms) aligned with app DEFAULT_SHORTFORM_VIDEO_RENDER_LEASE_MS.';
