-- 관광지별 상세 정보 (이름 + 설명 + 사진). 상세의 호텔 정보 아래 노출
alter table public.products
  add column if not exists attractions_json jsonb;

comment on column public.products.attractions_json is
  '관광지별 상세 정보 배열. [{ "name": "...", "content": "...", "images": ["https://..."] }]';
