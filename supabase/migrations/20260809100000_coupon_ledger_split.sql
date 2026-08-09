-- =============================================================================
-- 쿠폰·포인트 원장 분리: member_coupon_packs + coupon_ledger
-- 기존 KAKAO/COUPON_PACK point_ledger 행은 쿠폰 팩으로 백필 (포인트 잔액 유지)
-- =============================================================================

create table if not exists public.member_coupon_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete cascade,
  tier text not null check (tier in ('WELCOME', 'RETURNING')),
  unit_amount integer not null check (unit_amount > 0),
  status text not null default 'AVAILABLE'
    check (status in ('AVAILABLE', 'RESERVED', 'REDEEMED', 'EXPIRED', 'CANCELED')),
  source_ref_type text,
  source_ref_id text,
  reserved_booking_id uuid,
  redeemed_booking_id uuid,
  discount_applied integer,
  traveler_count integer,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_member_coupon_packs_user_status
  on public.member_coupon_packs(user_id, status);
create index if not exists idx_member_coupon_packs_reserved_booking
  on public.member_coupon_packs(reserved_booking_id)
  where reserved_booking_id is not null;
create index if not exists idx_member_coupon_packs_redeemed_booking
  on public.member_coupon_packs(redeemed_booking_id)
  where redeemed_booking_id is not null;

-- 동일 소스 중복 발급 방지 (source가 있는 경우)
create unique index if not exists uq_member_coupon_packs_source
  on public.member_coupon_packs(user_id, source_ref_type, source_ref_id)
  where source_ref_type is not null and source_ref_id is not null;

comment on table public.member_coupon_packs is '골프투어 전용 쿠폰팩 보유 자격';
comment on column public.member_coupon_packs.unit_amount is '1인당 할인 단가(원)';
comment on column public.member_coupon_packs.discount_applied is 'REDEEM 시 실제 적용 할인 총액';

create table if not exists public.coupon_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete cascade,
  pack_id uuid references public.member_coupon_packs(id) on delete set null,
  type text not null check (type in ('ISSUE', 'RESERVE', 'REDEEM', 'RELEASE', 'EXPIRE', 'ADJUST')),
  status text not null default 'CONFIRMED' check (status in ('PENDING', 'CONFIRMED', 'CANCELED')),
  amount integer not null check (amount > 0),
  reason text,
  ref_type text,
  ref_id text,
  booking_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_coupon_ledger_user_created
  on public.coupon_ledger(user_id, created_at desc);
create index if not exists idx_coupon_ledger_pack
  on public.coupon_ledger(pack_id) where pack_id is not null;
create index if not exists idx_coupon_ledger_booking
  on public.coupon_ledger(booking_id) where booking_id is not null;
create index if not exists idx_coupon_ledger_ref
  on public.coupon_ledger(ref_type, ref_id) where ref_type is not null;

comment on table public.coupon_ledger is '쿠폰팩 이벤트 원장. amount는 항상 양수';

alter table public.member_coupon_packs enable row level security;
alter table public.coupon_ledger enable row level security;

drop policy if exists service_role_all_member_coupon_packs on public.member_coupon_packs;
create policy service_role_all_member_coupon_packs
  on public.member_coupon_packs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists service_role_all_coupon_ledger on public.coupon_ledger;
create policy service_role_all_coupon_ledger
  on public.coupon_ledger
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.member_coupon_packs from anon, authenticated;
revoke all on public.coupon_ledger from anon, authenticated;
grant all on public.member_coupon_packs to service_role;
grant all on public.coupon_ledger to service_role;

-- -----------------------------------------------------------------------------
-- 백필: point_ledger 쿠폰 마커 → member_coupon_packs + coupon_ledger ISSUE
-- 포인트 잔액은 변경하지 않음 (양 원장 유지)
-- -----------------------------------------------------------------------------
insert into public.member_coupon_packs (
  user_id, tier, unit_amount, status, source_ref_type, source_ref_id, created_at, updated_at
)
select
  pl.user_id,
  case
    when pl.ref_type = 'COUPON_PACK_RETURNING' then 'RETURNING'
    else 'WELCOME'
  end as tier,
  case
    when pl.ref_type = 'COUPON_PACK_RETURNING' then 30000
    else 50000
  end as unit_amount,
  'AVAILABLE' as status,
  pl.ref_type as source_ref_type,
  coalesce(nullif(pl.ref_id, ''), pl.user_id::text) as source_ref_id,
  pl.created_at,
  pl.created_at
from public.point_ledger pl
where pl.ref_type in ('COUPON_PACK_WELCOME', 'COUPON_PACK_RETURNING', 'KAKAO_SIGNUP_WELCOME')
  and pl.type = 'EARN'
  and pl.status = 'CONFIRMED'
on conflict (user_id, source_ref_type, source_ref_id)
  where source_ref_type is not null and source_ref_id is not null
  do nothing;

insert into public.coupon_ledger (
  user_id, pack_id, type, status, amount, reason, ref_type, ref_id, created_at
)
select
  p.user_id,
  p.id,
  'ISSUE',
  'CONFIRMED',
  p.unit_amount,
  case when p.tier = 'RETURNING' then '3만원 쿠폰팩' else '5만원 쿠폰팩' end,
  p.source_ref_type,
  p.source_ref_id,
  p.created_at
from public.member_coupon_packs p
where not exists (
  select 1 from public.coupon_ledger cl
  where cl.pack_id = p.id and cl.type = 'ISSUE'
);
