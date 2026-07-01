alter table public.products add column if not exists departure_schedules_json jsonb;

comment on column public.products.departure_schedules_json is
  '출발일별 스케줄 [{ departureDate, returnDate?, price?, label?, status? }]';
