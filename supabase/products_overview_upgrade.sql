-- [STEP 0] 여행 오버뷰 필드
-- 상품 상세 첫 화면(above-the-fold)에서 여행 흐름 요약 노출용
-- overview_cover_url: 없으면 image_url fallback
-- overview_json: { summaryCards, themeChart?, days? }

alter table public.products add column if not exists overview_cover_url text;
alter table public.products add column if not exists overview_json jsonb;

comment on column public.products.overview_cover_url is '오버뷰 커버 이미지 URL. 없으면 image_url 사용';
comment on column public.products.overview_json is '오버뷰 요약: { summaryCards: [{label,value}], themeChart?: {labels,values}, days?: [{day,summary}] }';
