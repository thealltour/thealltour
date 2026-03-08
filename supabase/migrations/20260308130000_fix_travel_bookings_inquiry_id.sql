-- =============================================================================
-- PR4: travel_bookings.inquiry_id uuid FK 보정 (비파괴)
-- =============================================================================
--
-- 목적:
--   public.travel_bookings.inquiry_id 가 없을 때만 uuid 컬럼 + FK to inquiries(id) 를
--   추가합니다. 이미 uuid + FK 있으면 no-op. bigint 등 다른 타입이면 강제 변환하지 않습니다.
--
-- Destructive change를 하지 않는 이유:
--   inquiry_id 가 bigint 인 환경은 legacy mismatch 가능. 20260305110000_pr1_schema_rls_fix.sql
--   적용 여부 확인이 필요하며, 수동 데이터 검토 후 별도 migration 필요할 수 있습니다.
--
-- PR2-B / Phase 2:
--   inquiry_id uuid + FK 확정 후 앱 코드는 그대로 사용 가능. travel_bookings RLS는 건드리지 않음.
--
-- =============================================================================

do $$
declare
  col_exists boolean;
  col_type text;
  fk_exists boolean;
begin
  -- travel_bookings 테이블이 없으면 스킵
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'travel_bookings') then
    return;
  end if;

  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'travel_bookings' and column_name = 'inquiry_id') into col_exists;
  if not col_exists then
    -- inquiry_id 컬럼이 없으면: uuid 컬럼 + FK + 인덱스 추가
    alter table public.travel_bookings add column inquiry_id uuid references public.inquiries(id) on delete set null;
    create index if not exists idx_travel_bookings_inquiry_id on public.travel_bookings(inquiry_id) where inquiry_id is not null;
    return;
  end if;

  -- inquiry_id 컬럼이 존재함 → 타입 확인
  select data_type into col_type from information_schema.columns where table_schema = 'public' and table_name = 'travel_bookings' and column_name = 'inquiry_id';

  if col_type = 'uuid' then
    -- 이미 uuid: FK 있으면 no-op
    select exists (
      select 1 from information_schema.table_constraints
      where table_schema = 'public' and table_name = 'travel_bookings' and constraint_name = 'travel_bookings_inquiry_id_fkey'
    ) into fk_exists;
    if not fk_exists then
      alter table public.travel_bookings add constraint travel_bookings_inquiry_id_fkey foreign key (inquiry_id) references public.inquiries(id) on delete set null;
    end if;
    create index if not exists idx_travel_bookings_inquiry_id on public.travel_bookings(inquiry_id) where inquiry_id is not null;
    return;
  end if;

  -- inquiry_id가 bigint 또는 그 외 타입: 강제 alter 하지 않음
  -- legacy mismatch 가능성. 20260305110000_pr1_schema_rls_fix.sql 적용 여부 확인 필요.
  -- 수동 데이터 검토 후 별도 migration 필요할 수 있음.
  null;
end $$;
