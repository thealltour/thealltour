-- Planner AI generation quota (member: 1/KST day, anonymous: 1/lifetime)
-- Access: service_role / server API only. No anon/authenticated writes.

create table if not exists public.planner_generation_quota (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null
    check (subject_type in ('member', 'anonymous_key')),
  subject_id text not null,
  window_type text not null
    check (window_type in ('kst_day', 'lifetime')),
  window_key text not null,
  status text not null
    check (status in ('reserved', 'consumed')),
  session_id uuid not null
    references public.planner_sessions (id) on delete cascade,
  reserved_at timestamptz not null default now(),
  consumed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planner_generation_quota_window_unique
    unique (subject_type, subject_id, window_type, window_key),
  constraint planner_generation_quota_window_shape_chk check (
    (subject_type = 'member' and window_type = 'kst_day')
    or (subject_type = 'anonymous_key' and window_type = 'lifetime' and window_key = 'lifetime')
  ),
  constraint planner_generation_quota_consumed_at_chk check (
    (status = 'reserved' and consumed_at is null)
    or (status = 'consumed' and consumed_at is not null)
  )
);

comment on table public.planner_generation_quota is
  'AI Planner generation quota windows. reserved→consumed after successful plan persist; release deletes reserved.';

comment on column public.planner_generation_quota.subject_id is
  'member UUID or anonymousKey. Not PII beyond opaque identifiers.';

create index if not exists planner_generation_quota_session_id_idx
  on public.planner_generation_quota (session_id);

create index if not exists planner_generation_quota_reserved_at_idx
  on public.planner_generation_quota (reserved_at)
  where status = 'reserved';

alter table public.planner_generation_quota enable row level security;

drop policy if exists service_role_all_planner_generation_quota
  on public.planner_generation_quota;
create policy service_role_all_planner_generation_quota
  on public.planner_generation_quota
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.planner_generation_quota from anon, authenticated;
grant all on public.planner_generation_quota to service_role;

-- Stale reserved rows may be reclaimed after this TTL (serverless crash safety).
-- Constant mirrored in app: PLANNER_QUOTA_RESERVATION_TTL_MS = 15 * 60 * 1000

create or replace function public.reserve_planner_generation_quota(
  p_subject_type text,
  p_subject_id text,
  p_window_type text,
  p_window_key text,
  p_session_id uuid,
  p_now timestamptz default now(),
  p_stale_after_ms bigint default 900000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject_type text := nullif(trim(coalesce(p_subject_type, '')), '');
  v_subject_id text := nullif(trim(coalesce(p_subject_id, '')), '');
  v_window_type text := nullif(trim(coalesce(p_window_type, '')), '');
  v_window_key text := nullif(trim(coalesce(p_window_key, '')), '');
  v_stale_before timestamptz := p_now - make_interval(secs => greatest(p_stale_after_ms, 0) / 1000.0);
  v_row public.planner_generation_quota%rowtype;
begin
  if v_subject_type is null or v_subject_id is null or v_window_type is null or v_window_key is null then
    raise exception 'QUOTA_ARGS_REQUIRED';
  end if;
  if p_session_id is null then
    raise exception 'QUOTA_SESSION_REQUIRED';
  end if;

  -- Fast path: insert when no row exists for this window.
  begin
    insert into public.planner_generation_quota (
      subject_type, subject_id, window_type, window_key,
      status, session_id, reserved_at, created_at, updated_at
    ) values (
      v_subject_type, v_subject_id, v_window_type, v_window_key,
      'reserved', p_session_id, p_now, p_now, p_now
    )
    returning * into v_row;

    return jsonb_build_object(
      'result', 'reserved',
      'id', v_row.id,
      'session_id', v_row.session_id,
      'status', v_row.status
    );
  exception
    when unique_violation then
      null;
  end;

  select *
  into v_row
  from public.planner_generation_quota
  where subject_type = v_subject_type
    and subject_id = v_subject_id
    and window_type = v_window_type
    and window_key = v_window_key
  for update;

  if not found then
    -- Rare race: conflict then deleted — retry insert once.
    insert into public.planner_generation_quota (
      subject_type, subject_id, window_type, window_key,
      status, session_id, reserved_at, created_at, updated_at
    ) values (
      v_subject_type, v_subject_id, v_window_type, v_window_key,
      'reserved', p_session_id, p_now, p_now, p_now
    )
    returning * into v_row;

    return jsonb_build_object(
      'result', 'reserved',
      'id', v_row.id,
      'session_id', v_row.session_id,
      'status', v_row.status
    );
  end if;

  if v_row.status = 'consumed' then
    return jsonb_build_object(
      'result', 'already_consumed',
      'id', v_row.id,
      'session_id', v_row.session_id,
      'status', v_row.status
    );
  end if;

  -- reserved
  if v_row.session_id = p_session_id then
    update public.planner_generation_quota
    set reserved_at = p_now, updated_at = p_now
    where id = v_row.id
    returning * into v_row;

    return jsonb_build_object(
      'result', 'reserved',
      'id', v_row.id,
      'session_id', v_row.session_id,
      'status', v_row.status,
      'reused_same_session', true
    );
  end if;

  if v_row.reserved_at < v_stale_before then
    update public.planner_generation_quota
    set
      session_id = p_session_id,
      reserved_at = p_now,
      updated_at = p_now,
      status = 'reserved',
      consumed_at = null
    where id = v_row.id
    returning * into v_row;

    return jsonb_build_object(
      'result', 'reserved',
      'id', v_row.id,
      'session_id', v_row.session_id,
      'status', v_row.status,
      'reclaimed_stale', true
    );
  end if;

  return jsonb_build_object(
    'result', 'already_reserved',
    'id', v_row.id,
    'session_id', v_row.session_id,
    'status', v_row.status
  );
end;
$$;

revoke all on function public.reserve_planner_generation_quota(text, text, text, text, uuid, timestamptz, bigint)
  from public, anon, authenticated;
grant execute on function public.reserve_planner_generation_quota(text, text, text, text, uuid, timestamptz, bigint)
  to service_role;

create or replace function public.consume_planner_generation_quota(
  p_session_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.planner_generation_quota%rowtype;
begin
  if p_session_id is null then
    raise exception 'QUOTA_SESSION_REQUIRED';
  end if;

  update public.planner_generation_quota
  set
    status = 'consumed',
    consumed_at = p_now,
    updated_at = p_now
  where session_id = p_session_id
    and status = 'reserved'
  returning * into v_row;

  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;

  return jsonb_build_object(
    'result', 'consumed',
    'id', v_row.id,
    'session_id', v_row.session_id,
    'status', v_row.status
  );
end;
$$;

revoke all on function public.consume_planner_generation_quota(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.consume_planner_generation_quota(uuid, timestamptz)
  to service_role;

create or replace function public.release_planner_generation_quota(
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int := 0;
begin
  if p_session_id is null then
    raise exception 'QUOTA_SESSION_REQUIRED';
  end if;

  delete from public.planner_generation_quota
  where session_id = p_session_id
    and status = 'reserved';

  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'result', case when v_deleted > 0 then 'released' else 'not_found' end,
    'deleted', v_deleted
  );
end;
$$;

revoke all on function public.release_planner_generation_quota(uuid)
  from public, anon, authenticated;
grant execute on function public.release_planner_generation_quota(uuid)
  to service_role;
