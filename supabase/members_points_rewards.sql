-- =============================================================================
-- 회원 포인트 + 경품 교환소 (승인형, PG/결제 없음)
-- - members.points = 확정된 사용 가능 포인트(PointBalance)
-- - point_ledger = 적립/차감/소멸/조정 기록
-- - pending_points = 미확정 적립 (예약/출발/정산 대기 등)
-- - reward_catalog = 교환 가능 경품 목록
-- - reward_redemption = 경품 교환 신청 → 관리자 승인 → 발송
-- =============================================================================

-- members.points 컬럼이 없으면 추가 (기존 members_points_upgrade.sql 대비)
alter table public.members
  add column if not exists points integer not null default 0;
comment on column public.members.points is '확정 보유 포인트(PointBalance). 경품 교환 시에만 차감.';

-- -----------------------------------------------------------------------------
-- 포인트 원장 (모든 변동 기록)
-- -----------------------------------------------------------------------------
create table if not exists public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  kind text not null check (kind in ('accrual','deduction','expiration','adjustment')),
  amount integer not null,  -- 양수=적립/조정증가, 음수=차감/소멸
  balance_after integer,    -- 변동 후 잔액 (선택, 감사용)
  reason text,
  reference_type text,      -- 'manual' | 'redemption' | 'pending_confirm' 등
  reference_id uuid,        -- reward_redemption.id 등
  created_at timestamptz not null default now(),
  created_by uuid          -- 관리자 지급/조정 시
);

create index if not exists idx_point_ledger_member_created
  on public.point_ledger(member_id, created_at desc);

comment on table public.point_ledger is '포인트 적립/차감/소멸/조정 기록';

-- -----------------------------------------------------------------------------
-- 미확정 포인트 (예약/출발/정산 대기 등, 교환 불가)
-- -----------------------------------------------------------------------------
create table if not exists public.pending_points (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  amount integer not null check (amount > 0),
  reason text,
  reference_type text,
  reference_id text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  ledger_id uuid references public.point_ledger(id)
);

create index if not exists idx_pending_points_member_status
  on public.pending_points(member_id, status);

comment on table public.pending_points is '미확정 적립. approved 시 point_ledger 반영 후 members.points 증가';

-- -----------------------------------------------------------------------------
-- 경품 목록
-- -----------------------------------------------------------------------------
create table if not exists public.reward_catalog (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  point_price integer not null check (point_price > 0),
  image_url text,
  stock_count integer not null default 0 check (stock_count >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.reward_catalog is '교환 가능 경품 목록';

-- -----------------------------------------------------------------------------
-- 경품 교환 신청/승인/발송
-- -----------------------------------------------------------------------------
create table if not exists public.reward_redemption (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  reward_catalog_id uuid not null references public.reward_catalog(id) on delete restrict,
  point_amount integer not null check (point_amount > 0),
  status text not null default 'requested' check (status in ('requested','approved','rejected','shipped')),
  shipping_name text,
  shipping_phone text,
  shipping_address text,
  shipping_note text,
  admin_note text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid,
  ledger_id uuid references public.point_ledger(id)
);

create index if not exists idx_reward_redemption_member
  on public.reward_redemption(member_id, created_at desc);
create index if not exists idx_reward_redemption_status
  on public.reward_redemption(status);

comment on table public.reward_redemption is '경품 교환 신청 → 관리자 승인 → 발송';

-- -----------------------------------------------------------------------------
-- RLS (앱이 서버 API로만 접근 시, API에서 member_id/session 검사. anon 허용으로 서버 요청 처리)
-- -----------------------------------------------------------------------------
alter table public.point_ledger enable row level security;
alter table public.pending_points enable row level security;
alter table public.reward_catalog enable row level security;
alter table public.reward_redemption enable row level security;

drop policy if exists "Allow anon select point_ledger" on public.point_ledger;
create policy "Allow anon select point_ledger" on public.point_ledger for select to anon using (true);
drop policy if exists "Allow anon insert point_ledger" on public.point_ledger;
create policy "Allow anon insert point_ledger" on public.point_ledger for insert to anon with check (true);

drop policy if exists "Allow anon select pending_points" on public.pending_points;
create policy "Allow anon select pending_points" on public.pending_points for select to anon using (true);

drop policy if exists "Allow anon select reward_catalog" on public.reward_catalog;
create policy "Allow anon select reward_catalog" on public.reward_catalog for select to anon using (true);
drop policy if exists "Allow anon insert reward_catalog" on public.reward_catalog;
create policy "Allow anon insert reward_catalog" on public.reward_catalog for insert to anon with check (true);
drop policy if exists "Allow anon update reward_catalog" on public.reward_catalog;
create policy "Allow anon update reward_catalog" on public.reward_catalog for update to anon using (true) with check (true);

drop policy if exists "Allow anon select reward_redemption" on public.reward_redemption;
create policy "Allow anon select reward_redemption" on public.reward_redemption for select to anon using (true);
drop policy if exists "Allow anon insert reward_redemption" on public.reward_redemption;
create policy "Allow anon insert reward_redemption" on public.reward_redemption for insert to anon with check (true);
drop policy if exists "Allow anon update reward_redemption" on public.reward_redemption;
create policy "Allow anon update reward_redemption" on public.reward_redemption for update to anon using (true) with check (true);
