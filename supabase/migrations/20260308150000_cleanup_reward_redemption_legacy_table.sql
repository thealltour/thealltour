-- =============================================================================
-- Phase 2 PR7: reward_redemption(단수) 레거시 테이블 정리
-- =============================================================================
--
-- 목적:
--   public.reward_redemption(단수) 테이블에 남아 있는 데이터를
--   public.reward_redemptions(복수)로 이전한 뒤, 단수 테이블을 제거합니다.
--
-- 전제:
--   앱 코드는 이미 reward_redemptions(복수)만 사용하도록 전환된 상태입니다.
--   단수 테이블은 레거시 SQL/문서에만 남아 있습니다.
--
-- 선행 조건:
--   public.reward_redemptions 테이블이 반드시 존재해야 합니다.
--   (PR4 migration 20260308110000 또는 20250304 등으로 이미 생성된 상태)
--
-- 실행 전 권장:
--   - public.reward_redemption, public.reward_redemptions 백업 권장
--   - 스테이징/개발 환경에서 먼저 적용 후 검증
--
-- 이번 PR 범위:
--   단수 테이블 데이터 이전 및 drop 만 수행합니다.
--   RLS/정책/인덱스 별도 정리는 하지 않습니다.
--
-- Destructive change:
--   이 migration은 drop table 을 수행합니다.
--   가드 조건 미충족 시 이전 및 drop 을 실행하지 않고 exception 으로 중단합니다.
--
-- =============================================================================

do $$
declare
  singular_exists boolean;
  plural_exists boolean;
  has_s_id boolean;
  has_s_member_id boolean;
  has_s_reward_catalog_id boolean;
  has_s_point_amount boolean;
  has_s_status boolean;
  has_s_created_at boolean;
  has_p_id boolean;
  has_p_user_id boolean;
  has_p_catalog_id boolean;
  has_p_point_amount boolean;
  has_p_status boolean;
  has_p_requested_at boolean;
  has_p_created_at boolean;
  has_p_updated_at boolean;
  has_p_shipping_name boolean;
  has_p_shipping_phone boolean;
  has_p_shipping_address1 boolean;
begin
  -- 1) reward_redemption(단수) 존재 여부
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'reward_redemption'
  ) into singular_exists;

  if not singular_exists then
    return; -- no-op: 단수 테이블 없으면 아무것도 하지 않음
  end if;

  -- 2) reward_redemptions(복수) 존재 여부
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'reward_redemptions'
  ) into plural_exists;

  if not plural_exists then
    raise exception 'Phase 2 PR7: reward_redemption(단수) 정리를 중단합니다. reward_redemptions(복수) 테이블이 없습니다. 복수 테이블을 먼저 준비한 뒤 이 migration을 적용하세요.';
  end if;

  -- 3) 단수 테이블 최소 컬럼 존재 여부
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reward_redemption' and column_name = 'id') into has_s_id;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reward_redemption' and column_name = 'member_id') into has_s_member_id;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reward_redemption' and column_name = 'reward_catalog_id') into has_s_reward_catalog_id;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reward_redemption' and column_name = 'point_amount') into has_s_point_amount;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reward_redemption' and column_name = 'status') into has_s_status;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reward_redemption' and column_name = 'created_at') into has_s_created_at;

  if not (has_s_id and has_s_member_id and has_s_reward_catalog_id and has_s_point_amount and has_s_status and has_s_created_at) then
    raise exception 'Phase 2 PR7: reward_redemption(단수) 테이블에 필수 컬럼(id, member_id, reward_catalog_id, point_amount, status, created_at)이 없습니다.';
  end if;

  -- 4) 복수 테이블 최소 컬럼 존재 여부
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reward_redemptions' and column_name = 'id') into has_p_id;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reward_redemptions' and column_name = 'user_id') into has_p_user_id;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reward_redemptions' and column_name = 'catalog_id') into has_p_catalog_id;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reward_redemptions' and column_name = 'point_amount') into has_p_point_amount;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reward_redemptions' and column_name = 'status') into has_p_status;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reward_redemptions' and column_name = 'requested_at') into has_p_requested_at;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reward_redemptions' and column_name = 'created_at') into has_p_created_at;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reward_redemptions' and column_name = 'updated_at') into has_p_updated_at;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reward_redemptions' and column_name = 'shipping_name') into has_p_shipping_name;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reward_redemptions' and column_name = 'shipping_phone') into has_p_shipping_phone;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reward_redemptions' and column_name = 'shipping_address1') into has_p_shipping_address1;

  if not (has_p_id and has_p_user_id and has_p_catalog_id and has_p_point_amount and has_p_status and has_p_requested_at and has_p_created_at and has_p_updated_at and has_p_shipping_name and has_p_shipping_phone and has_p_shipping_address1) then
    raise exception 'Phase 2 PR7: reward_redemptions(복수) 테이블에 필수 컬럼이 없습니다. PR4 normalize_reward_redemptions 또는 동등 migration 적용 후 다시 시도하세요.';
  end if;

  -- 5) 데이터 이전: 단수 -> 복수 (이미 같은 id가 복수에 있으면 skip, on conflict do nothing)
  insert into public.reward_redemptions (
    id,
    user_id,
    catalog_id,
    status,
    point_amount,
    requested_at,
    decided_at,
    shipped_at,
    completed_at,
    admin_memo,
    user_message,
    shipping_name,
    shipping_phone,
    shipping_address1,
    shipping_address2,
    shipping_zip,
    tracking_carrier,
    tracking_number,
    created_at,
    updated_at
  )
  select
    r.id,
    r.member_id,
    r.reward_catalog_id,
    case lower(trim(coalesce(r.status, '')))
      when 'requested' then 'REQUESTED'
      when 'approved' then 'APPROVED'
      when 'rejected' then 'REJECTED'
      when 'shipped' then 'SHIPPED'
      else 'REQUESTED'
    end,
    r.point_amount,
    r.created_at,
    r.processed_at,
    case when lower(trim(coalesce(r.status, ''))) = 'shipped' then r.processed_at else null end,
    null,
    r.admin_note,
    r.shipping_note,
    coalesce(r.shipping_name, ''),
    coalesce(r.shipping_phone, ''),
    coalesce(r.shipping_address, ''),
    null,
    null,
    null,
    null,
    r.created_at,
    coalesce(r.processed_at, r.created_at, now())
  from public.reward_redemption r
  where not exists (select 1 from public.reward_redemptions rr where rr.id = r.id)
  on conflict (id) do nothing;

  -- 6) 단수 테이블 제거
  drop table public.reward_redemption;
end $$;
