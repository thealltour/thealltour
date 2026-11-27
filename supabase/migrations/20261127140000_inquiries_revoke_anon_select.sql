-- Hotfix: block unauthenticated direct SELECT of inquiry PII.
-- Keeps RLS enabled. Does not alter service_role bypass behavior.
-- App intake continues via service_role (supabaseAdmin), not anon grants.

alter table public.inquiries enable row level security;

drop policy if exists "Allow public read inquiries" on public.inquiries;

-- Table-level SELECT (anon + PUBLIC inheritance)
revoke select on table public.inquiries from anon;
revoke select on table public.inquiries from public;

-- Column-level SELECT leftovers for anon / PUBLIC (effective-privilege cleanup).
-- Column lists are dynamic; role targets stay fixed SQL (anon as identifier, PUBLIC as keyword).
do $$
declare
  anon_cols text;
  public_cols text;
begin
  select string_agg(format('%I', column_name), ', ' order by column_name)
  into anon_cols
  from information_schema.column_privileges
  where table_schema = 'public'
    and table_name = 'inquiries'
    and privilege_type = 'SELECT'
    and grantee = 'anon';

  if anon_cols is not null then
    execute format(
      'revoke select (%s) on table public.inquiries from anon',
      anon_cols
    );
  end if;

  select string_agg(format('%I', column_name), ', ' order by column_name)
  into public_cols
  from information_schema.column_privileges
  where table_schema = 'public'
    and table_name = 'inquiries'
    and privilege_type = 'SELECT'
    and grantee = 'PUBLIC';

  if public_cols is not null then
    execute format(
      'revoke select (%s) on table public.inquiries from PUBLIC',
      public_cols
    );
  end if;
end
$$;
