-- [STEP 0] 구조화 일정: Day별 이벤트(제목/설명/시간대/아이콘) 저장
-- 있으면 상세에서 시각화 타임라인 우선, 없으면 detailed_schedule 텍스트 fallback

alter table public.products add column if not exists itinerary_days_json jsonb;

comment on column public.products.itinerary_days_json is '구조화 일정. [{ day, title?, coverImageUrl?, events: [{ heading, description?, timeOfDay?, iconKey? }] }]. 있으면 시각화 타임라인 우선 사용';
