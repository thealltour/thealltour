-- 상품 관리자 6가지 필드: status, options, fuel_included, price_meta, meta_info, one_liner
-- 설계 문서: docs/design/product-admin-six-fields.md

-- 상품 상태: 예약 가능 / 잔여 한정 / 마감 / 상담 후 안내
alter table public.products add column if not exists status text;
comment on column public.products.status is 'AVAILABLE|LIMITED|SOLD_OUT|CONSULT_REQUIRED, null이면 프론트에서 AVAILABLE';

-- 상품 옵션 정의 (기간·룸 등 선택 시 견적 계산용 JSON)
alter table public.products add column if not exists options jsonb;
comment on column public.products.options is 'ProductOptions: basePrice, currency, requiredGroups, groups[]';

-- 유류할증료 포함 여부 (상세 요약 카드 문구용)
alter table public.products add column if not exists fuel_included boolean;
comment on column public.products.fuel_included is 'true=포함, false=별도, null=문구 미노출';

-- 가격 기준 문구 (카드/상세 "1인 기준" 등)
alter table public.products add column if not exists price_meta text;
comment on column public.products.price_meta is '카드·상세 가격 기준 문구, 예: 1인 기준';

-- 카드 메타 문구 (카드에 일정·지역 옆 표시, 예: 항공 포함)
alter table public.products add column if not exists meta_info text;
comment on column public.products.meta_info is '상품 카드 부가 문구, 예: 항공 포함';

-- 한 줄 소개 (상세 상단 요약, 비우면 description 첫 줄 사용)
alter table public.products add column if not exists one_liner text;
comment on column public.products.one_liner is '상세 상단 한 줄 소개';
