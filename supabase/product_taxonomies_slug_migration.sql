-- 기존 DB에 slug 컬럼 추가 (이미 있으면 스킵)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'slug'
  ) then
    alter table public.product_taxonomies add column slug text;
  end if;
end $$;
