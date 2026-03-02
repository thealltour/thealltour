-- [STEP 3] Day별 일정 이미지 (업로드 URL 저장)
-- itinerary_media_json: { "1": "https://...", "2": "https://..." } 형태로 Day별 대표 이미지 URL

alter table public.products add column if not exists itinerary_media_json jsonb;

comment on column public.products.itinerary_media_json is '일정 Day별 대표 이미지 URL. 예: { "1": "https://...", "2": "https://..." }';
