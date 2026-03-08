-- =============================================================================
-- Phase 2 PR6: point_ledger 레거시 컬럼 제거
-- =============================================================================
--
-- 목적:
--   public.point_ledger 에서 앱이 더 이상 사용하지 않는 레거시 컬럼을 제거합니다.
--   제거 대상: member_id, kind, balance_after, reference_type, reference_id, created_by
--
-- 선행 조건 (필수):
--   반드시 PR4 migration "20260308100000_normalize_point_ledger.sql" 적용 이후에만
--   이 migration을 실행해야 합니다. PR4 미적용 환경에서 실행하면 데이터 정합성 위험이 있습니다.
--
-- 실행 전 권장 사항:
--   - public.point_ledger 테이블 백업 권장 (pg_dump 또는 Supabase Backups)
--   - 스테이징/개발 환경에서 먼저 적용 후 앱 동작 검증
--
-- 이번 PR 범위:
--   point_ledger 레거시 컬럼만 정리합니다.
--   reward_redemption(단수) / RLS / products / docs 는 건드리지 않습니다.
--
-- Destructive change:
--   이 migration은 drop column 을 수행합니다. 가드 조건 미충족 시 drop 을 실행하지 않고
--   exception 으로 중단합니다.
--
-- =============================================================================

do $$
declare
  tbl_exists boolean;
  has_user_id boolean;
  has_type boolean;
  has_status boolean;
  has_ref_type boolean;
  has_ref_id boolean;
  null_user_count bigint;
begin
  -- 1) point_ledger 테이블 존재 여부
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'point_ledger'
  ) into tbl_exists;

  if not tbl_exists then
    return; -- no-op: 테이블 없으면 아무것도 하지 않음
  end if;

  -- 2) PR4 목표 컬럼 존재 여부 확인 (이 컬럼들이 있어야 레거시 drop 안전)
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'point_ledger' and column_name = 'user_id') into has_user_id;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'point_ledger' and column_name = 'type') into has_type;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'point_ledger' and column_name = 'status') into has_status;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'point_ledger' and column_name = 'ref_type') into has_ref_type;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'point_ledger' and column_name = 'ref_id') into has_ref_id;

  if not (has_user_id and has_type and has_status and has_ref_type and has_ref_id) then
    raise exception 'Phase 2 PR6: point_ledger 레거시 컬럼 제거를 중단합니다. PR4 normalize_point_ledger 미적용 또는 목표 컬럼(user_id, type, status, ref_type, ref_id)이 없습니다. 먼저 20260308100000_normalize_point_ledger.sql 을 적용하세요.';
  end if;

  -- 3) user_id null 인 행이 있으면 drop 진행하지 않음 (데이터 미정합)
  select count(*) from public.point_ledger where user_id is null into null_user_count;
  if null_user_count > 0 then
    raise exception 'Phase 2 PR6: point_ledger 레거시 컬럼 제거를 중단합니다. user_id 가 null 인 행이 % 건 있습니다. PR4 backfill 또는 데이터 정합성을 먼저 확인하세요.', null_user_count;
  end if;

  -- 4) 조건 충족 시에만 레거시 컬럼 drop (if exists 로 이미 제거된 환경은 no-op)
  alter table public.point_ledger drop column if exists member_id;
  alter table public.point_ledger drop column if exists kind;
  alter table public.point_ledger drop column if exists balance_after;
  alter table public.point_ledger drop column if exists reference_type;
  alter table public.point_ledger drop column if exists reference_id;
  alter table public.point_ledger drop column if exists created_by;
end $$;
