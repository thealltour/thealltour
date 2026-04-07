-- PR-A: 약관/유의사항/예약조건 필드 분리 (terms_and_notes 하위호환 유지)

alter table public.products add column if not exists booking_notes text;
alter table public.products add column if not exists travel_notes text;
alter table public.products add column if not exists booking_conditions text;

comment on column public.products.booking_notes is '예약 시 유의사항';
comment on column public.products.travel_notes is '여행 시 유의사항';
comment on column public.products.booking_conditions is '예약조건';
