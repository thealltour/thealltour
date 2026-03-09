-- product_taxonomies: 허브 카드/랜딩용 메타 컬럼 추가 (card_image_url 등)
-- 타입(ProductTaxonomy)에 이미 정의돼 있음. 수동 설정 시 카드에 반영됨.

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'card_title') then
    alter table public.product_taxonomies add column card_title text;
    comment on column public.product_taxonomies.card_title is '허브 카드 제목. 비어 있으면 name 사용.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'card_description') then
    alter table public.product_taxonomies add column card_description text;
    comment on column public.product_taxonomies.card_description is '허브 카드 설명.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'card_image_url') then
    alter table public.product_taxonomies add column card_image_url text;
    comment on column public.product_taxonomies.card_image_url is '허브 카드 이미지 URL. 비어 있으면 해당 분류 상품 대표 이미지 자동 사용.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'landing_title') then
    alter table public.product_taxonomies add column landing_title text;
    comment on column public.product_taxonomies.landing_title is '상세 랜딩 페이지 제목.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'landing_description') then
    alter table public.product_taxonomies add column landing_description text;
    comment on column public.product_taxonomies.landing_description is '상세 랜딩 페이지 설명.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'hero_image_url') then
    alter table public.product_taxonomies add column hero_image_url text;
    comment on column public.product_taxonomies.hero_image_url is '상세 랜딩 히어로 이미지 URL.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'seo_title') then
    alter table public.product_taxonomies add column seo_title text;
    comment on column public.product_taxonomies.seo_title is 'SEO 메타 제목.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'seo_description') then
    alter table public.product_taxonomies add column seo_description text;
    comment on column public.product_taxonomies.seo_description is 'SEO 메타 설명.';
  end if;
end $$;
