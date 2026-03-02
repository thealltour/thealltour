-- 항공편 수하물 한도 컬럼 추가 (출발/도착)

alter table public.products
  add column if not exists departure_baggage_limit text,
  add column if not exists arrival_baggage_limit text;
