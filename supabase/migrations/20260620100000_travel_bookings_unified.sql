-- =============================================================================
-- 통합 예약: 예약번호, 여행자, 결제, confirm/complete RPC
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) travel_bookings 확장
-- -----------------------------------------------------------------------------
alter table public.travel_bookings
  add column if not exists booking_number text,
  add column if not exists traveler_count integer,
  add column if not exists payer_name text,
  add column if not exists primary_traveler_phone text,
  add column if not exists payment_status text default 'unpaid',
  add column if not exists payment_method text,
  add column if not exists payment_total_amount integer,
  add column if not exists payment_paid_amount integer default 0,
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists payment_external_id text,
  add column if not exists member_id uuid references public.members(id) on delete set null,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by_admin_id text,
  add column if not exists booking_confirmed_sms_sent_at timestamptz,
  add column if not exists trip_completed_sms_sent_at timestamptz,
  add column if not exists shipping_name text,
  add column if not exists shipping_phone text,
  add column if not exists shipping_zip text,
  add column if not exists shipping_address1 text,
  add column if not exists shipping_address2 text;

update public.travel_bookings
set
  booking_number = coalesce(booking_number, 'TA-LEGACY-' || upper(substr(id::text, 1, 8))),
  traveler_count = coalesce(traveler_count, 1),
  payment_status = coalesce(payment_status, 'unpaid'),
  payment_paid_amount = coalesce(payment_paid_amount, 0)
where booking_number is null or traveler_count is null;

alter table public.travel_bookings alter column booking_number set not null;
alter table public.travel_bookings alter column traveler_count set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'travel_bookings_booking_number_key') then
    alter table public.travel_bookings add constraint travel_bookings_booking_number_key unique (booking_number);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'travel_bookings_traveler_count_positive') then
    alter table public.travel_bookings add constraint travel_bookings_traveler_count_positive check (traveler_count >= 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'travel_bookings_payment_status_check') then
    alter table public.travel_bookings add constraint travel_bookings_payment_status_check
      check (payment_status in ('unpaid', 'partial', 'paid', 'refunded'));
  end if;
end $$;

create index if not exists idx_travel_bookings_booking_number on public.travel_bookings(booking_number);
create index if not exists idx_travel_bookings_member_id on public.travel_bookings(member_id) where member_id is not null;
create index if not exists idx_travel_bookings_payment_status on public.travel_bookings(payment_status);

-- -----------------------------------------------------------------------------
-- 2) booking_travelers
-- -----------------------------------------------------------------------------
create table if not exists public.booking_travelers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.travel_bookings(id) on delete cascade,
  sort_order integer not null default 1 check (sort_order >= 1),
  full_name text not null default '',
  phone text,
  email text,
  passport_number text,
  passport_expiry date,
  birth_date date,
  gender text,
  nationality text,
  is_primary boolean not null default false,
  is_payer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_booking_travelers_booking_id on public.booking_travelers(booking_id, sort_order);

alter table public.booking_travelers enable row level security;

-- -----------------------------------------------------------------------------
-- 3) booking_payments (PG-ready)
-- -----------------------------------------------------------------------------
create table if not exists public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.travel_bookings(id) on delete cascade,
  amount integer not null check (amount > 0),
  method text not null default 'transfer',
  status text not null default 'recorded' check (status in ('recorded', 'pending', 'confirmed', 'failed', 'refunded')),
  external_provider text,
  external_payment_id text,
  recorded_by text,
  admin_memo text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_booking_payments_booking_id on public.booking_payments(booking_id, recorded_at desc);

alter table public.booking_payments enable row level security;

-- -----------------------------------------------------------------------------
-- 4) point_earn_requests ↔ travel_bookings
-- -----------------------------------------------------------------------------
alter table public.point_earn_requests
  add column if not exists booking_id uuid references public.travel_bookings(id) on delete set null;

create index if not exists idx_point_earn_requests_booking_id on public.point_earn_requests(booking_id) where booking_id is not null;

-- -----------------------------------------------------------------------------
-- 5) 예약번호 생성 헬퍼
-- -----------------------------------------------------------------------------
create or replace function public.generate_booking_number()
returns text
language plpgsql
as $$
declare
  v_num text;
  v_try integer := 0;
begin
  loop
    v_try := v_try + 1;
    v_num := format('TA-%s-%s', to_char(now() at time zone 'Asia/Seoul', 'YYYYMMDD'), upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)));
    exit when not exists (select 1 from public.travel_bookings where booking_number = v_num);
    if v_try >= 20 then
      raise exception 'BOOKING_NUMBER_GENERATION_FAILED';
    end if;
  end loop;
  return v_num;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6) confirm_travel_booking RPC
-- -----------------------------------------------------------------------------
create or replace function public.confirm_travel_booking(
  p_customer_profile_id uuid,
  p_inquiry_id bigint default null,
  p_product_id text default null,
  p_product_title text default null,
  p_source_path text default null,
  p_departure_date date default null,
  p_return_date date default null,
  p_traveler_count integer default 1,
  p_payer_name text default null,
  p_primary_traveler_phone text default null,
  p_member_id uuid default null,
  p_payment_status text default 'unpaid',
  p_payment_method text default null,
  p_payment_total_amount integer default null,
  p_payment_paid_amount integer default 0,
  p_shipping_name text default null,
  p_shipping_phone text default null,
  p_shipping_zip text default null,
  p_shipping_address1 text default null,
  p_shipping_address2 text default null,
  p_travelers jsonb default '[]'::jsonb,
  p_confirmed_by text default 'ADMIN'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_booking_number text;
  v_now timestamptz := now();
  v_traveler jsonb;
  v_sort integer := 0;
  v_paid integer := coalesce(p_payment_paid_amount, 0);
begin
  if p_customer_profile_id is null then
    raise exception 'CUSTOMER_PROFILE_REQUIRED';
  end if;
  if p_traveler_count < 1 then
    raise exception 'INVALID_TRAVELER_COUNT';
  end if;
  if p_inquiry_id is not null and exists (
    select 1 from public.travel_bookings where inquiry_id = p_inquiry_id and booking_status <> 'canceled'
  ) then
    raise exception 'INQUIRY_ALREADY_BOOKED';
  end if;

  v_booking_number := public.generate_booking_number();

  insert into public.travel_bookings (
    customer_profile_id, inquiry_id, product_id, product_title, source_path,
    booking_status, departure_date, return_date,
    booking_number, traveler_count, payer_name, primary_traveler_phone,
    member_id, payment_status, payment_method, payment_total_amount, payment_paid_amount,
    payment_confirmed_at, shipping_name, shipping_phone, shipping_zip, shipping_address1, shipping_address2,
    confirmed_at, confirmed_by_admin_id, updated_at
  ) values (
    p_customer_profile_id, p_inquiry_id, nullif(trim(p_product_id), ''), nullif(trim(p_product_title), ''), nullif(trim(p_source_path), ''),
    'reserved', p_departure_date, p_return_date,
    v_booking_number, p_traveler_count, nullif(trim(p_payer_name), ''), nullif(trim(p_primary_traveler_phone), ''),
    p_member_id, coalesce(nullif(trim(p_payment_status), ''), 'unpaid'), nullif(trim(p_payment_method), ''),
    p_payment_total_amount, v_paid,
    case when v_paid > 0 and p_payment_status in ('paid', 'partial') then v_now else null end,
    nullif(trim(p_shipping_name), ''), nullif(trim(p_shipping_phone), ''), nullif(trim(p_shipping_zip), ''),
    nullif(trim(p_shipping_address1), ''), nullif(trim(p_shipping_address2), ''),
    v_now, coalesce(nullif(trim(p_confirmed_by), ''), 'ADMIN'), v_now
  )
  returning id into v_booking_id;

  for v_traveler in select * from jsonb_array_elements(coalesce(p_travelers, '[]'::jsonb))
  loop
    v_sort := v_sort + 1;
    insert into public.booking_travelers (
      booking_id, sort_order, full_name, phone, email,
      passport_number, passport_expiry, birth_date, gender, nationality,
      is_primary, is_payer, updated_at
    ) values (
      v_booking_id,
      coalesce((v_traveler->>'sort_order')::integer, v_sort),
      coalesce(nullif(trim(v_traveler->>'full_name'), ''), '여행자'),
      nullif(trim(v_traveler->>'phone'), ''),
      nullif(trim(v_traveler->>'email'), ''),
      nullif(trim(v_traveler->>'passport_number'), ''),
      case when (v_traveler->>'passport_expiry') ~ '^\d{4}-\d{2}-\d{2}' then (v_traveler->>'passport_expiry')::date else null end,
      case when (v_traveler->>'birth_date') ~ '^\d{4}-\d{2}-\d{2}' then (v_traveler->>'birth_date')::date else null end,
      nullif(trim(v_traveler->>'gender'), ''),
      nullif(trim(v_traveler->>'nationality'), ''),
      coalesce((v_traveler->>'is_primary')::boolean, v_sort = 1),
      coalesce((v_traveler->>'is_payer')::boolean, false),
      v_now
    );
  end loop;

  if v_paid > 0 then
    insert into public.booking_payments (booking_id, amount, method, status, recorded_by, admin_memo)
    values (
      v_booking_id, v_paid,
      coalesce(nullif(trim(p_payment_method), ''), 'transfer'),
      'recorded',
      coalesce(nullif(trim(p_confirmed_by), ''), 'ADMIN'),
      '예약 확정 시 초기 결제 기록'
    );
  end if;

  if p_inquiry_id is not null then
    update public.inquiries
    set consultation_status = 'closed', booking_status = 'reserved', last_activity_at = v_now
    where id = p_inquiry_id;
  end if;

  return jsonb_build_object(
    'booking_id', v_booking_id,
    'booking_number', v_booking_number,
    'inquiry_id', p_inquiry_id,
    'traveler_count', p_traveler_count
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 7) complete_travel_booking RPC
-- -----------------------------------------------------------------------------
create or replace function public.complete_travel_booking(
  p_booking_id uuid,
  p_completed_by text default 'ADMIN'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
  v_now timestamptz := now();
begin
  select id, inquiry_id, booking_status, booking_number, customer_profile_id
  into v_booking
  from public.travel_bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
  if v_booking.booking_status <> 'reserved' then
    raise exception 'INVALID_BOOKING_STATUS:%', v_booking.booking_status;
  end if;

  update public.travel_bookings
  set booking_status = 'completed', travel_completed_at = v_now, updated_at = v_now
  where id = p_booking_id;

  if v_booking.inquiry_id is not null then
    update public.inquiries
    set booking_status = 'completed', completed_at = v_now, last_activity_at = v_now
    where id = v_booking.inquiry_id;
  end if;

  return jsonb_build_object(
    'booking_id', p_booking_id,
    'booking_number', v_booking.booking_number,
    'inquiry_id', v_booking.inquiry_id,
    'customer_profile_id', v_booking.customer_profile_id
  );
end;
$$;

comment on function public.confirm_travel_booking is '예약 확정: booking_number 발급 + travelers + payment + inquiry 상태';
comment on function public.complete_travel_booking is '여행 완료: booking/inquiry completed';
