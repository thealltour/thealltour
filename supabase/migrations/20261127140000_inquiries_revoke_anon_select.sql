-- Hotfix: block unauthenticated direct SELECT of inquiry PII.
-- Keeps RLS enabled. Does not alter service_role bypass behavior.
-- App intake continues via service_role (supabaseAdmin), not anon grants.

alter table public.inquiries enable row level security;

drop policy if exists "Allow public read inquiries" on public.inquiries;

-- Table-level SELECT (anon + PUBLIC inheritance)
revoke select on table public.inquiries from anon;
revoke select on table public.inquiries from public;

-- Column-level SELECT leftovers for anon / PUBLIC (effective-privilege cleanup)
do $$
declare
  r record;
begin
  for r in
    select
      grantee::text as grantee,
      string_agg(format('%I', column_name), ', ' order by column_name) as cols
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'inquiries'
      and privilege_type = 'SELECT'
      and grantee in ('anon', 'PUBLIC')
    group by grantee
  loop
    execute format(
      'revoke select (%s) on table public.inquiries from %I',
      r.cols,
      r.grantee
    );
  end loop;
end
$$;
