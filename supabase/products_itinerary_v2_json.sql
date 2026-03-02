-- [STEP 1] 구조화 일정 v2: jsonb 1컬럼 (시각화 최적화)
-- itinerary_v2_json: days[].day, dateText?, title?, coverImageUrl?, events[] (timeOfDay, iconKey, heading, description?, location?, order?)

alter table public.products add column if not exists itinerary_v2_json jsonb;

comment on column public.products.itinerary_v2_json is '구조화 일정 v2. { days: [{ day, dateText?, title?, coverImageUrl?, events: [{ timeOfDay?, iconKey?, heading, description?, location?, order? }] }] }';
