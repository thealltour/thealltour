-- Security Advisor: SECURITY DEFINER → security_invoker, anon/authenticated revoke
-- 점검용 뷰 (앱 런타임 미사용). 원본 정의는 pg_get_viewdef 기준.

drop view if exists public.product_notice_migration_candidates;

create view public.product_notice_migration_candidates
with (security_invoker = true)
as
select
  id,
  title,
  included_items,
  excluded_items,
  optional_tours,
  terms_and_notes,
  booking_notes,
  travel_notes,
  booking_conditions,
  terms_template_type,
  booking_notes_template_type
from public.products p
where
  coalesce(nullif(trim(both from included_items), ''::text), ''::text) = ''::text
  and coalesce(nullif(trim(both from excluded_items), ''::text), ''::text) = ''::text
  and (
    coalesce(nullif(trim(both from optional_tours), ''::text), ''::text) <> ''::text
    or coalesce(nullif(trim(both from terms_and_notes), ''::text), ''::text) <> ''::text
  )
  or coalesce(nullif(trim(both from booking_notes), ''::text), ''::text) <> ''::text
  and coalesce(nullif(trim(both from travel_notes), ''::text), ''::text) = ''::text
  and coalesce(nullif(trim(both from booking_conditions), ''::text), ''::text) = ''::text;

comment on view public.product_notice_migration_candidates is
  '일회성: 상품 안내 필드 마이그레이션 후보 점검. service_role/관리자 SQL 전용.';

revoke all on public.product_notice_migration_candidates from anon, authenticated;
grant select on public.product_notice_migration_candidates to service_role;
