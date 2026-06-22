-- Security Advisor phase 1: function search_path, RPC execute grants, storage listing

-- -----------------------------------------------------------------------------
-- 1-A) Pin search_path on trigger/helper functions
-- -----------------------------------------------------------------------------

create or replace function public.slug_from_name(name_val text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  s text;
begin
  s := lower(trim(name_val));
  s := regexp_replace(s, '\s+', '-', 'g');
  s := regexp_replace(s, '[^a-z0-9\-]', '', 'g');
  s := regexp_replace(s, '-+', '-', 'g');
  s := trim(both '-' from s);
  return nullif(s, '');
end;
$$;

create or replace function public.generate_booking_number()
returns text
language plpgsql
set search_path = public
as $$
declare
  v_num text;
  v_try integer := 0;
begin
  loop
    v_try := v_try + 1;
    v_num := format(
      'TA-%s-%s',
      to_char(now() at time zone 'Asia/Seoul', 'YYYYMMDD'),
      upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4))
    );
    exit when not exists (select 1 from public.travel_bookings where booking_number = v_num);
    if v_try >= 20 then
      raise exception 'BOOKING_NUMBER_GENERATION_FAILED';
    end if;
  end loop;
  return v_num;
end;
$$;

create or replace function public.set_guides_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_notices_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_timestamp'
  loop
    execute format('alter function public.set_timestamp(%s) set search_path = public', r.args);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1-B) Restrict SECURITY DEFINER RPC execute to service_role
-- -----------------------------------------------------------------------------

revoke all on function public.approve_point_earn_request(uuid, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.approve_point_earn_request(uuid, text, timestamptz, text)
  to service_role;

revoke all on function public.update_point_earn_request_gift_status(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.update_point_earn_request_gift_status(uuid, text, text)
  to service_role;

revoke all on function public.complete_travel_booking(uuid, text)
  from public, anon, authenticated;
grant execute on function public.complete_travel_booking(uuid, text)
  to service_role;

revoke all on function public.confirm_travel_booking(
  uuid, bigint, text, text, text, date, date, integer, text, text, uuid,
  text, text, integer, integer, text, text, text, text, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.confirm_travel_booking(
  uuid, bigint, text, text, text, date, date, integer, text, text, uuid,
  text, text, integer, integer, text, text, text, text, text, jsonb, text
) to service_role;

-- -----------------------------------------------------------------------------
-- 1-C) Public bucket: remove broad SELECT (direct URL access still works)
-- -----------------------------------------------------------------------------

drop policy if exists "Public read review images" on storage.objects;
