-- 여행 오버뷰 카드 전용 입력 필드 (기본정보에서 직접 입력)
-- mapProductToOverview에서 이 값들이 있으면 우선 사용, 없으면 기존 자동 추출 로직 사용

alter table public.products add column if not exists overview_accommodation text;
comment on column public.products.overview_accommodation is '여행 오버뷰 숙소 카드 값 (예: 상담 시 안내, 전일정4성)';

alter table public.products add column if not exists overview_region text;
comment on column public.products.overview_region is '여행 오버뷰 지역 카드 값 (예: 호주, 동남아)';

alter table public.products add column if not exists overview_duration text;
comment on column public.products.overview_duration is '여행 오버뷰 기간 카드 값 (예: 6일, 3박4일)';
