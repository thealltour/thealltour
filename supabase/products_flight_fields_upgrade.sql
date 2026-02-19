alter table public.products add column if not exists departure_from_airport text;
alter table public.products add column if not exists departure_from_date text;
alter table public.products add column if not exists departure_from_time text;
alter table public.products add column if not exists departure_to_airport text;
alter table public.products add column if not exists departure_to_date text;
alter table public.products add column if not exists departure_to_time text;
alter table public.products add column if not exists departure_flight_name text;

alter table public.products add column if not exists arrival_from_airport text;
alter table public.products add column if not exists arrival_from_date text;
alter table public.products add column if not exists arrival_from_time text;
alter table public.products add column if not exists arrival_to_airport text;
alter table public.products add column if not exists arrival_to_date text;
alter table public.products add column if not exists arrival_to_time text;
alter table public.products add column if not exists arrival_flight_name text;

comment on column public.products.departure_from_airport is '출발 항공편 출발공항';
comment on column public.products.departure_from_date is '출발 항공편 출발일자';
comment on column public.products.departure_from_time is '출발 항공편 출발시각';
comment on column public.products.departure_to_airport is '출발 항공편 도착공항';
comment on column public.products.departure_to_date is '출발 항공편 도착일자';
comment on column public.products.departure_to_time is '출발 항공편 도착시각';
comment on column public.products.departure_flight_name is '출발 항공편명';

comment on column public.products.arrival_from_airport is '도착 항공편 출발공항';
comment on column public.products.arrival_from_date is '도착 항공편 출발일자';
comment on column public.products.arrival_from_time is '도착 항공편 출발시각';
comment on column public.products.arrival_to_airport is '도착 항공편 도착공항';
comment on column public.products.arrival_to_date is '도착 항공편 도착일자';
comment on column public.products.arrival_to_time is '도착 항공편 도착시각';
comment on column public.products.arrival_flight_name is '도착 항공편명';
