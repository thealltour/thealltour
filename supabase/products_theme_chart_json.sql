-- 일정 테마 구성비 차트: 상품 등록 시 관리자가 직접 입력
-- theme_chart_json: { items: [{ label: string, percent: number }] }

alter table public.products add column if not exists theme_chart_json jsonb;

comment on column public.products.theme_chart_json is '일정 테마 구성비. { items: [{ label, percent }] }. 상품 등록 시 입력, 없으면 theme/category 기반 자동 생성';
