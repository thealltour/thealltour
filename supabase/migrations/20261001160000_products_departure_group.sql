-- 같은 상품의 출발지별 분리 등록 (예: 인천출발 / 부산출발). 상세에서 출발지 전환 칩으로 연결
alter table public.products
  add column if not exists departure_city text,
  add column if not exists departure_group_id uuid;

create index if not exists products_departure_group_id_idx
  on public.products (departure_group_id)
  where departure_group_id is not null;

comment on column public.products.departure_city is
  '출발지 라벨 (예: 인천, 부산). 상세 출발지역·출발지 전환 칩에 표시';

comment on column public.products.departure_group_id is
  '같은 상품을 출발지별로 나눠 등록했을 때 공유하는 묶음 id. null이면 단독 상품';
