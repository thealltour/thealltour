-- Atomic planner plan edit persistence:
-- session row FOR UPDATE → CAS (optional) → bootstrap v1 → insert next version → update plan_json
-- Prevents orphan planner_plan_versions when Manual Edit CAS fails.
-- Access: service_role / server API only.

create or replace function public.persist_planner_plan_edit(
  p_session_id uuid,
  p_next_plan jsonb,
  p_edit_instruction text,
  p_status text default null,
  p_expected_updated_at timestamptz default null,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.planner_sessions%rowtype;
  v_max_version integer := 0;
  v_next_version integer;
  v_instruction text := nullif(left(trim(coalesce(p_edit_instruction, '')), 1000), '');
  v_has_versions boolean := false;
begin
  if p_session_id is null then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if p_next_plan is null or jsonb_typeof(p_next_plan) <> 'object' then
    return jsonb_build_object('outcome', 'invalid_plan');
  end if;

  -- Serialize edits for this session (row-level lock only).
  select *
  into v_session
  from public.planner_sessions
  where id = p_session_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  -- Locked status is source of truth; never flip draft/generated/saved here.
  -- p_status is accepted for API compatibility but ignored for the write.
  if v_session.status is distinct from 'generated'
     and v_session.status is distinct from 'saved' then
    return jsonb_build_object(
      'outcome', 'invalid_status',
      'status', v_session.status
    );
  end if;

  if v_session.plan_json is null then
    return jsonb_build_object('outcome', 'missing_plan');
  end if;

  -- Manual Edit CAS: fail before any version INSERT.
  if p_expected_updated_at is not null
     and v_session.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object(
      'outcome', 'conflict',
      'updated_at', v_session.updated_at,
      'status', v_session.status
    );
  end if;

  select exists (
    select 1
    from public.planner_plan_versions
    where planner_session_id = p_session_id
  )
  into v_has_versions;

  if not v_has_versions then
    -- Bootstrap: authoritative previous plan is locked session.plan_json.
    insert into public.planner_plan_versions (
      planner_session_id,
      version_number,
      plan_json,
      edit_instruction
    ) values (
      p_session_id,
      1,
      v_session.plan_json,
      null
    );
    v_max_version := 1;
  else
    select coalesce(max(version_number), 0)
    into v_max_version
    from public.planner_plan_versions
    where planner_session_id = p_session_id;
  end if;

  v_next_version := v_max_version + 1;

  insert into public.planner_plan_versions (
    planner_session_id,
    version_number,
    plan_json,
    edit_instruction
  ) values (
    p_session_id,
    v_next_version,
    p_next_plan,
    v_instruction
  );

  update public.planner_sessions
  set
    plan_json = p_next_plan,
    updated_at = p_now
    -- status intentionally unchanged (generated|saved)
  where id = p_session_id
  returning * into v_session;

  return jsonb_build_object(
    'outcome', 'updated',
    'version_number', v_next_version,
    'updated_at', v_session.updated_at,
    'status', v_session.status
  );
end;
$$;

revoke all on function public.persist_planner_plan_edit(uuid, jsonb, text, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.persist_planner_plan_edit(uuid, jsonb, text, text, timestamptz, timestamptz)
  to service_role;

comment on function public.persist_planner_plan_edit(uuid, jsonb, text, text, timestamptz, timestamptz) is
  'Atomic planner edit: FOR UPDATE session, optional updated_at CAS, bootstrap v1, insert version, update plan_json. service_role only.';
