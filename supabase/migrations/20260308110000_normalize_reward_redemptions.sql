-- =============================================================================
-- PR4: reward_redemptions 테이블 정합성 보정 (비파괴)
-- =============================================================================
--
-- 목적:
--   baseline 목표 스키마에 맞춰 public.reward_redemptions(복수) 테이블이 없으면 생성하고,
--   있으면 누락된 컬럼만 add column if not exists 로 보정합니다.
--
-- Destructive change를 하지 않는 이유:
--   public.reward_redemption(단수) 테이블은 레거시 호환용으로 유지합니다.
--   drop table / view 생성(동일 이름 충돌) / 데이터 이전 강제는 하지 않습니다.
--
-- PR2-B / Phase 2:
--   reward_redemption(단수)는 PR2-B 코드 전환 및 Phase 2 이후 정리 검토.
--   shipping_postcode 미사용, shipping_zip 기준 유지.
--
-- =============================================================================

do $$
begin
  -- reward_redemptions 테이블이 없으면 baseline 기준으로 생성
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'reward_redemptions'
  ) then
    create table public.reward_redemptions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.members(id) on delete restrict,
      catalog_id uuid not null references public.reward_catalog(id) on delete restrict,
      status text not null default 'REQUESTED' check (status in ('REQUESTED', 'APPROVED', 'REJECTED', 'SHIPPED', 'COMPLETED', 'CANCELED')),
      point_amount integer not null check (point_amount > 0),
      requested_at timestamptz not null default now(),
      decided_at timestamptz,
      shipped_at timestamptz,
      completed_at timestamptz,
      admin_memo text,
      user_message text,
      shipping_name text not null default '',
      shipping_phone text not null default '',
      shipping_address1 text not null default '',
      shipping_address2 text,
      shipping_zip text,
      tracking_carrier text,
      tracking_number text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists idx_reward_redemptions_user_created on public.reward_redemptions(user_id, created_at desc);
    create index if not exists idx_reward_redemptions_status on public.reward_redemptions(status);
    create index if not exists idx_reward_redemptions_catalog on public.reward_redemptions(catalog_id);
    return;
  end if;

  -- 테이블이 있으면 누락 컬럼만 추가 (add column if not exists)
  alter table public.reward_redemptions add column if not exists user_id uuid;
  alter table public.reward_redemptions add column if not exists catalog_id uuid;
  alter table public.reward_redemptions add column if not exists status text default 'REQUESTED';
  alter table public.reward_redemptions add column if not exists point_amount integer;
  alter table public.reward_redemptions add column if not exists requested_at timestamptz default now();
  alter table public.reward_redemptions add column if not exists decided_at timestamptz;
  alter table public.reward_redemptions add column if not exists shipped_at timestamptz;
  alter table public.reward_redemptions add column if not exists completed_at timestamptz;
  alter table public.reward_redemptions add column if not exists admin_memo text;
  alter table public.reward_redemptions add column if not exists user_message text;
  alter table public.reward_redemptions add column if not exists shipping_name text default '';
  alter table public.reward_redemptions add column if not exists shipping_phone text default '';
  alter table public.reward_redemptions add column if not exists shipping_address1 text default '';
  alter table public.reward_redemptions add column if not exists shipping_address2 text;
  alter table public.reward_redemptions add column if not exists shipping_zip text;
  alter table public.reward_redemptions add column if not exists tracking_carrier text;
  alter table public.reward_redemptions add column if not exists tracking_number text;
  alter table public.reward_redemptions add column if not exists created_at timestamptz default now();
  alter table public.reward_redemptions add column if not exists updated_at timestamptz default now();
end $$;

-- 인덱스 보강 (테이블이 있을 때만)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'reward_redemptions') then
    create index if not exists idx_reward_redemptions_user_created on public.reward_redemptions(user_id, created_at desc);
    create index if not exists idx_reward_redemptions_status on public.reward_redemptions(status);
    create index if not exists idx_reward_redemptions_catalog on public.reward_redemptions(catalog_id);
  end if;
end $$;
