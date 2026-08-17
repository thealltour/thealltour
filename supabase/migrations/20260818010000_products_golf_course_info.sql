-- 상품 상세 골프장 정보 (상품 소개 옆 2열). 비어 있으면 상세 미노출
alter table public.products add column if not exists golf_course_info text;

comment on column public.products.golf_course_info is '골프장 정보 본문. 비어 있으면 상품 상세에서 숨김';
