-- 선택경비(optional_expenses) 및 상품 핵심안내(selling_points_json) 컬럼 추가
alter table public.products add column if not exists optional_expenses text;
alter table public.products add column if not exists selling_points_json jsonb;

comment on column public.products.optional_expenses is '선택경비 내역 (포함/불포함과 별도)';
comment on column public.products.selling_points_json is '상품 핵심안내 JSON: corePoints, tourism, meals, transport, insurance';
