-- 호텔별 상세 정보 (이름 + 설명 + 사진). 상세의 골프장 정보 아래 노출
alter table public.products
  add column if not exists hotels_json jsonb;

comment on column public.products.hotels_json is
  '호텔별 상세 정보 배열. [{ "name": "...", "content": "...", "images": ["https://..."] }]';

comment on column public.products.golf_courses_json is
  '골프장별 상세 정보 배열. [{ "name": "...", "content": "...", "images": ["https://..."] }]';
