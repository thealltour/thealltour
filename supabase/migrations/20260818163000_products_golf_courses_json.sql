-- 골프장별 상세 정보 (이름 + 설명). 상세에서 이름 클릭 시 모달 노출용
alter table public.products
  add column if not exists golf_courses_json jsonb;

comment on column public.products.golf_courses_json is
  '골프장별 상세 정보 배열. [{ "name": "...", "content": "..." }]';
