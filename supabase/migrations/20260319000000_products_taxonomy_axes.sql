-- PR-TAX-6 (Phase 2): 상품 스키마를 새 taxonomy 축에 맞게 확장.
-- legacy category/theme는 유지하고, destination_id/product_line_id 등 추가.
-- 적용 후 앱에서 새 필드 우선 사용, 비어 있으면 category/theme fallback.

-- 1) destination_id: 지역 1개 (product_taxonomies.id, taxonomy_type='destination' 권장)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'destination_id'
  ) then
    alter table public.products add column destination_id uuid references public.product_taxonomies(id) on delete set null;
    comment on column public.products.destination_id is '지역 1개. taxonomy_type=destination인 행만 저장 권장. 비어 있으면 category fallback.';
  end if;
end $$;

-- 2) product_line_id: 상품군 1개 (product_taxonomies.id, taxonomy_type='product_line' 권장)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'product_line_id'
  ) then
    alter table public.products add column product_line_id uuid references public.product_taxonomies(id) on delete set null;
    comment on column public.products.product_line_id is '상품군 1개. taxonomy_type=product_line인 행만 저장 권장. 비어 있으면 category fallback.';
  end if;
end $$;

-- 3) campaigns_json: 기획/강조 다중 (선택). 예: ["마감임박","추천"] 또는 taxonomy id 배열
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'campaigns_json'
  ) then
    alter table public.products add column campaigns_json jsonb;
    comment on column public.products.campaigns_json is '기획/강조 항목. 문자열 배열 또는 uuid 배열. taxonomy_type=campaign.';
  end if;
end $$;

-- 4) tags_json: 태그 다중 (선택)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'tags_json'
  ) then
    alter table public.products add column tags_json jsonb;
    comment on column public.products.tags_json is '태그 이름 배열. 예: ["가족","럭셔리"].';
  end if;
end $$;

-- 5) 인덱스: 필터/허브 조회용
create index if not exists idx_products_destination_id on public.products(destination_id) where destination_id is not null;
create index if not exists idx_products_product_line_id on public.products(product_line_id) where product_line_id is not null;

-- 6) legacy 컬럼 주석 (제거하지 않음, fallback 유지)
comment on column public.products.category is 'legacy. destination_id/product_line_id 비어 있을 때 fallback. 점진적 이전 후 deprecated 예정.';
comment on column public.products.theme is 'legacy. 테마 이름 토큰 문자열. 점진적 이전 후 theme_ids_json 등 검토.';
