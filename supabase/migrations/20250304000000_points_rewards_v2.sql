-- =============================================================================
-- 포인트·경품·알림 스키마 v2
-- - members 확장 (point_balance, point_pending, grade_id, marketing_opt_in)
-- - point_ledger (type: EARN|USE|EXPIRE|ADJUST|RESERVE|RELEASE, status: PENDING|CONFIRMED|CANCELED)
-- - reward_catalog (point_cost, stock nullable)
-- - reward_redemptions (상세 배송/트래킹/상태 필드)
-- - notifications
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) members 테이블 확장 (users 역할 = members)
-- -----------------------------------------------------------------------------
alter table public.members add column if not exists point_balance integer not null default 0;
alter table public.members add column if not exists point_pending integer not null default 0;
alter table public.members add column if not exists grade_id uuid;
comment on column public.members.grade_id is '등급(추후 grades 테이블 FK)';
alter table public.members add column if not exists marketing_opt_in boolean not null default false;
-- phone: members에 이미 있음. nullable로 쓰려면: alter table public.members alter column phone drop not null;

comment on column public.members.point_balance is '사용 가능 포인트(확정)';
comment on column public.members.point_pending is '미확정 적립 합계 캐시(선택)';

-- 기존 points 컬럼이 있으면 point_balance와 동기화 (1회)
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'members' and column_name = 'points') then
    update public.members set point_balance = coalesce(points, 0) where point_balance = 0 or point_balance is null;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2) point_ledger (기존 테이블 제거 후 재생성)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'point_ledger') then
    -- reward_redemption(단수) 레거시 테이블이 있을 때만 FK/컬럼 제거 (없으면 스킵)
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'reward_redemption') then
      alter table public.reward_redemption drop constraint if exists reward_redemption_ledger_id_fkey;
      alter table public.reward_redemption drop column if exists ledger_id;
    end if;
    drop policy if exists "Allow anon select point_ledger" on public.point_ledger;
    drop policy if exists "Allow anon insert point_ledger" on public.point_ledger;
  end if;
end $$;
drop table if exists public.pending_points;
drop table if exists public.point_ledger;

create table public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete cascade,
  type text not null check (type in ('EARN','USE','EXPIRE','ADJUST','RESERVE','RELEASE')),
  status text not null default 'CONFIRMED' check (status in ('PENDING','CONFIRMED','CANCELED')),
  amount integer not null check (amount > 0),
  reason text,
  ref_type text,
  ref_id text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_point_ledger_user_created on public.point_ledger(user_id, created_at desc);
create index if not exists idx_point_ledger_user_status on public.point_ledger(user_id, status);
create index if not exists idx_point_ledger_ref on public.point_ledger(ref_type, ref_id) where ref_type is not null;

comment on table public.point_ledger is '포인트 원장. amount는 항상 양수, type으로 적립/사용/소멸/조정/예약/해제 구분';
comment on column public.point_ledger.user_id is 'members.id (users 역할)';

-- -----------------------------------------------------------------------------
-- 3) reward_catalog (테이블 없으면 생성, 있으면 point_cost/stock 추가)
-- -----------------------------------------------------------------------------
create table if not exists public.reward_catalog (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  point_price integer not null default 0 check (point_price >= 0),
  point_cost integer default 0,
  image_url text,
  stock_count integer not null default 0 check (stock_count >= 0),
  stock integer,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reward_catalog add column if not exists point_cost integer;
alter table public.reward_catalog add column if not exists stock integer;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reward_catalog' and column_name = 'point_price') then
    update public.reward_catalog set point_cost = point_price where point_cost is null;
  end if;
  update public.reward_catalog set point_cost = 0 where point_cost is null;
end $$;
alter table public.reward_catalog alter column point_cost set default 0;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reward_catalog_point_cost_positive') then
    alter table public.reward_catalog add constraint reward_catalog_point_cost_positive check (point_cost is null or point_cost >= 0);
  end if;
end $$;
comment on column public.reward_catalog.stock is 'null이면 무제한';
comment on column public.reward_catalog.point_cost is '필요 포인트';

-- -----------------------------------------------------------------------------
-- 4) reward_redemptions (새 테이블: 상세 스키마, 기존 reward_redemption과 별도)
-- -----------------------------------------------------------------------------
create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete restrict,
  catalog_id uuid not null references public.reward_catalog(id) on delete restrict,
  status text not null default 'REQUESTED' check (status in ('REQUESTED','APPROVED','REJECTED','SHIPPED','COMPLETED','CANCELED')),
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

comment on table public.reward_redemptions is '경품 교환 신청/승인/발송 (상세 스키마)';
comment on column public.reward_redemptions.user_id is 'members.id';

-- -----------------------------------------------------------------------------
-- 5) notifications
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete cascade,
  type text not null check (type in ('REWARD_STATUS','POINT_EARNED','ADMIN_MESSAGE')),
  title text not null default '',
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_user_read on public.notifications(user_id, is_read) where is_read = false;

comment on table public.notifications is '회원 알림 (경품 상태, 포인트 적립, 관리자 메시지)';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.point_ledger enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Allow anon point_ledger" on public.point_ledger;
create policy "Allow anon point_ledger" on public.point_ledger for all to anon using (true) with check (true);

drop policy if exists "Allow anon reward_redemptions" on public.reward_redemptions;
create policy "Allow anon reward_redemptions" on public.reward_redemptions for all to anon using (true) with check (true);

drop policy if exists "Allow anon notifications" on public.notifications;
create policy "Allow anon notifications" on public.notifications for all to anon using (true) with check (true);
