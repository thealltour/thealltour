-- PR-D: 예약/여행/예약조건별 약관 템플릿 타입 (product_terms_templates.type 키와 동일 값 사용)

alter table public.products add column if not exists booking_notes_template_type text;
alter table public.products add column if not exists travel_notes_template_type text;
alter table public.products add column if not exists booking_conditions_template_type text;

comment on column public.products.booking_notes_template_type is '예약 시 유의사항용 약관 템플릿 키 (예: overseas_brokerage)';
comment on column public.products.travel_notes_template_type is '여행 시 유의사항용 약관 템플릿 키';
comment on column public.products.booking_conditions_template_type is '예약조건용 약관 템플릿 키';
