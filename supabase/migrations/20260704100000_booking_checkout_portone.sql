-- =============================================================================
-- 상품 checkout: checkout_snapshot, PortOne 예약금/잔금, pending_deposit 상태
-- =============================================================================

alter table public.travel_bookings
  add column if not exists checkout_snapshot jsonb,
  add column if not exists balance_payment_preference text,
  add column if not exists cash_receipt_requested boolean not null default false,
  add column if not exists local_perks_matched boolean not null default false;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'travel_bookings_booking_status_check'
  ) then
    alter table public.travel_bookings drop constraint travel_bookings_booking_status_check;
  end if;
end $$;

alter table public.travel_bookings
  add constraint travel_bookings_booking_status_check
  check (booking_status in ('pending_deposit', 'reserved', 'completed', 'canceled'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'travel_bookings_balance_payment_preference_check'
  ) then
    alter table public.travel_bookings
      add constraint travel_bookings_balance_payment_preference_check
      check (balance_payment_preference is null or balance_payment_preference in ('cash_receipt', 'portone'));
  end if;
end $$;

alter table public.booking_payments
  add column if not exists payment_kind text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'booking_payments_payment_kind_check'
  ) then
    alter table public.booking_payments
      add constraint booking_payments_payment_kind_check
      check (payment_kind is null or payment_kind in ('deposit', 'balance'));
  end if;
end $$;

create index if not exists idx_travel_bookings_pending_deposit
  on public.travel_bookings(booking_status)
  where booking_status = 'pending_deposit';

comment on column public.travel_bookings.checkout_snapshot is '상품 checkout 견적 스냅샷 (출발일, 옵션, 포인트, 예약금/잔금)';
comment on column public.booking_payments.payment_kind is 'deposit | balance';
