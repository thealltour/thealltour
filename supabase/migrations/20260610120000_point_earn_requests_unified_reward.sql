-- =============================================================================
-- 인당 정비례 통합 리워드: point_earn_requests 확장 + 원자적 승인/배송 RPC
-- =============================================================================

alter table public.point_earn_requests
  add column if not exists traveler_count integer not null default 1
    check (traveler_count >= 1 and traveler_count <= 99),
  add column if not exists gift_status text not null default 'PENDING'
    check (gift_status in ('PENDING', 'SHIPPED', 'COMPLETED', 'CANCELED')),
  add column if not exists shipping_name text,
  add column if not exists shipping_phone text,
  add column if not exists shipping_zip text,
  add column if not exists shipping_address1 text,
  add column if not exists shipping_address2 text;

comment on column public.point_earn_requests.traveler_count is '여행 인원수 (N). 포인트=20000*N, 골프공=10000원*N';
comment on column public.point_earn_requests.gift_status is '현물 골프공 배송 상태';

create index if not exists idx_point_earn_requests_gift_status
  on public.point_earn_requests(gift_status)
  where status = 'APPROVED';

-- -----------------------------------------------------------------------------
-- approve_point_earn_request: 승인 + EARN 원장 + balance 반영 (단일 트랜잭션)
-- -----------------------------------------------------------------------------
create or replace function public.approve_point_earn_request(
  p_request_id uuid,
  p_admin_memo text default null,
  p_expires_at timestamptz default null,
  p_decided_by text default 'ADMIN'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_amount integer;
  v_ledger_id uuid;
  v_balance integer;
  v_now timestamptz := now();
  c_points_per_traveler constant integer := 20000;
begin
  select id, user_id, status, booking_ref, traveler_count
  into v_req
  from public.point_earn_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  if v_req.status <> 'REQUESTED' then
    raise exception 'INVALID_STATUS:%', v_req.status;
  end if;

  if v_req.traveler_count < 1 or v_req.traveler_count > 99 then
    raise exception 'INVALID_TRAVELER_COUNT:%', v_req.traveler_count;
  end if;

  v_amount := v_req.traveler_count * c_points_per_traveler;

  select point_balance into v_balance
  from public.members
  where id = v_req.user_id
  for update;

  if not found then
    raise exception 'MEMBER_NOT_FOUND';
  end if;

  update public.point_earn_requests
  set
    status = 'APPROVED',
    gift_status = 'PENDING',
    admin_memo = nullif(trim(p_admin_memo), ''),
    decided_at = v_now,
    decided_by_admin_id = coalesce(nullif(trim(p_decided_by), ''), 'ADMIN')
  where id = p_request_id
    and status = 'REQUESTED';

  if not found then
    raise exception 'STATUS_UPDATE_FAILED';
  end if;

  insert into public.point_ledger (
    user_id, type, status, amount, reason, ref_type, ref_id, expires_at, created_at
  ) values (
    v_req.user_id,
    'EARN',
    'CONFIRMED',
    v_amount,
    format('예약 적립 요청 승인 (%s, %s명)', v_req.booking_ref, v_req.traveler_count),
    'EARN_REQUEST',
    p_request_id::text,
    p_expires_at,
    v_now
  )
  returning id into v_ledger_id;

  update public.members
  set point_balance = coalesce(v_balance, 0) + v_amount
  where id = v_req.user_id;

  insert into public.notifications (user_id, type, title, body)
  values (
    v_req.user_id,
    'POINT_EARNED',
    '포인트 적립',
    format('%sP가 적립되었습니다.', v_amount)
  );

  return jsonb_build_object(
    'ledger_id', v_ledger_id,
    'amount', v_amount,
    'user_id', v_req.user_id,
    'booking_ref', v_req.booking_ref,
    'traveler_count', v_req.traveler_count,
    'gift_status', 'PENDING'
  );
end;
$$;

comment on function public.approve_point_earn_request is
  '예약 증빙 승인: traveler_count*20000P EARN CONFIRMED + balance 반영 (원자적)';

-- -----------------------------------------------------------------------------
-- update_point_earn_request_gift_status: 골프공 배송 상태 전이
-- -----------------------------------------------------------------------------
create or replace function public.update_point_earn_request_gift_status(
  p_request_id uuid,
  p_gift_status text,
  p_admin_memo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_now timestamptz := now();
begin
  if p_gift_status not in ('SHIPPED', 'COMPLETED') then
    raise exception 'INVALID_GIFT_STATUS:%', p_gift_status;
  end if;

  select id, user_id, status, gift_status, booking_ref, traveler_count
  into v_req
  from public.point_earn_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  if v_req.status <> 'APPROVED' then
    raise exception 'INVALID_REQUEST_STATUS:%', v_req.status;
  end if;

  if p_gift_status = 'SHIPPED' and v_req.gift_status <> 'PENDING' then
    raise exception 'INVALID_GIFT_TRANSITION:%->SHIPPED', v_req.gift_status;
  end if;

  if p_gift_status = 'COMPLETED' and v_req.gift_status not in ('PENDING', 'SHIPPED') then
    raise exception 'INVALID_GIFT_TRANSITION:%->COMPLETED', v_req.gift_status;
  end if;

  update public.point_earn_requests
  set
    gift_status = p_gift_status,
    admin_memo = coalesce(nullif(trim(p_admin_memo), ''), admin_memo)
  where id = p_request_id;

  return jsonb_build_object(
    'request_id', p_request_id,
    'user_id', v_req.user_id,
    'gift_status', p_gift_status,
    'traveler_count', v_req.traveler_count,
    'booking_ref', v_req.booking_ref
  );
end;
$$;

comment on function public.update_point_earn_request_gift_status is
  '승인된 적립 요청의 골프공 배송 상태 변경 (PENDING→SHIPPED→COMPLETED)';
