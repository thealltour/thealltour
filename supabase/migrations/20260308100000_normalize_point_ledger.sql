-- =============================================================================
-- PR4: point_ledger 정합성 보정 (비파괴)
-- =============================================================================
--
-- 목적:
--   baseline 목표 스키마(user_id, type, status, ref_type, ref_id, expires_at, created_at)
--   에 맞추기 위해 누락된 컬럼만 추가하고 기존 행을 backfill 합니다.
--
-- Destructive change를 하지 않는 이유:
--   레거시 컬럼(member_id, kind, balance_after, reference_type, reference_id, created_by)은
--   유지합니다. PR2-B 코드 전환 후 Phase 2에서만 제거 검토합니다.
--
-- PR2-B / Phase 2:
--   이 migration 적용 후 앱이 point_ledger.user_id, type, status, ref_type, ref_id 를
--   사용할 수 있습니다. member_id/kind drop 은 Phase 2에서만 검토합니다.
--
-- =============================================================================

do $$
declare
  has_user_id boolean;
  has_member_id boolean;
  has_type boolean;
  has_kind boolean;
  has_status boolean;
  has_ref_type boolean;
  has_reference_type boolean;
  has_ref_id boolean;
  has_reference_id boolean;
  has_expires_at boolean;
  has_created_at boolean;
  fk_exists boolean;
begin
  -- point_ledger 테이블이 없으면 스킵
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'point_ledger'
  ) then
    return;
  end if;

  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'point_ledger' and column_name = 'user_id') into has_user_id;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'point_ledger' and column_name = 'member_id') into has_member_id;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'point_ledger' and column_name = 'type') into has_type;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'point_ledger' and column_name = 'kind') into has_kind;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'point_ledger' and column_name = 'status') into has_status;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'point_ledger' and column_name = 'ref_type') into has_ref_type;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'point_ledger' and column_name = 'reference_type') into has_reference_type;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'point_ledger' and column_name = 'ref_id') into has_ref_id;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'point_ledger' and column_name = 'reference_id') into has_reference_id;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'point_ledger' and column_name = 'expires_at') into has_expires_at;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'point_ledger' and column_name = 'created_at') into has_created_at;

  -- user_id: 없고 member_id 있으면 추가 + backfill + not null + FK
  if not has_user_id and has_member_id then
    alter table public.point_ledger add column if not exists user_id uuid;
    update public.point_ledger set user_id = member_id where user_id is null and member_id is not null;
    alter table public.point_ledger alter column user_id set not null;
  end if;

  -- type: 없고 kind 있으면 추가 + backfill
  if not has_type and has_kind then
    alter table public.point_ledger add column if not exists type text;
    update public.point_ledger set type = case kind
      when 'accrual' then 'EARN'
      when 'deduction' then 'USE'
      when 'expiration' then 'EXPIRE'
      when 'adjustment' then 'ADJUST'
      else 'EARN'
    end where type is null and kind is not null;
  end if;

  -- status: 없으면 추가
  if not has_status then
    alter table public.point_ledger add column if not exists status text default 'CONFIRMED';
    update public.point_ledger set status = 'CONFIRMED' where status is null;
  end if;

  -- ref_type: 없고 reference_type 있으면 추가 + backfill
  if not has_ref_type and has_reference_type then
    alter table public.point_ledger add column if not exists ref_type text;
    update public.point_ledger set ref_type = reference_type where ref_type is null and reference_type is not null;
  end if;

  -- ref_id: 없고 reference_id 있으면 추가 + backfill (uuid -> text)
  if not has_ref_id and has_reference_id then
    alter table public.point_ledger add column if not exists ref_id text;
    update public.point_ledger set ref_id = reference_id::text where ref_id is null and reference_id is not null;
  end if;

  -- expires_at: 없으면 추가
  if not has_expires_at then
    alter table public.point_ledger add column if not exists expires_at timestamptz;
  end if;

  -- created_at: 없으면 추가
  if not has_created_at then
    alter table public.point_ledger add column if not exists created_at timestamptz not null default now();
  end if;

  -- user_id FK가 없고 user_id 컬럼이 있으면 추가
  if (has_user_id or (not has_user_id and has_member_id)) then
    select exists (
      select 1 from information_schema.table_constraints
      where table_schema = 'public' and table_name = 'point_ledger' and constraint_name = 'point_ledger_user_id_fkey'
    ) into fk_exists;
    if not fk_exists then
      alter table public.point_ledger add constraint point_ledger_user_id_fkey
        foreign key (user_id) references public.members(id) on delete cascade;
    end if;
  end if;
end $$;

-- 인덱스 (point_ledger 테이블이 있을 때만; if not exists 로 안전하게)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'point_ledger') then
    create index if not exists idx_point_ledger_user_created on public.point_ledger(user_id, created_at desc);
    create index if not exists idx_point_ledger_user_status on public.point_ledger(user_id, status);
    create index if not exists idx_point_ledger_ref on public.point_ledger(ref_type, ref_id) where ref_type is not null;
  end if;
end $$;
