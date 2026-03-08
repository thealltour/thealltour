-- 지역(목적지) 등 계층 구조: 대분류(해외/국내) 아래 세부 지역을 묶기 위한 parent_id
-- parent_id가 null이면 최상위(대분류), 있으면 해당 항목의 하위(세부).

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'parent_id'
  ) then
    alter table public.product_taxonomies
      add column parent_id uuid references public.product_taxonomies(id) on delete set null;
    comment on column public.product_taxonomies.parent_id is '상위 분류(대분류). null이면 최상위. 같은 taxonomy_type만 허용 권장.';
  end if;
end $$;

create index if not exists idx_product_taxonomies_parent_id
  on public.product_taxonomies(parent_id)
  where parent_id is not null;
