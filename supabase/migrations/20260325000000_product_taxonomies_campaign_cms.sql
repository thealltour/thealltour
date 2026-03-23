-- PR3: 기획(campaign) taxonomy — 상품 카드 배지 CMS 필드
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'display_label'
  ) then
    alter table public.product_taxonomies add column display_label text;
    comment on column public.product_taxonomies.display_label is '상품 카드 대표 배지 표시 라벨. 비어 있으면 name.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'badge_priority'
  ) then
    alter table public.product_taxonomies add column badge_priority integer not null default 100;
    comment on column public.product_taxonomies.badge_priority is '카드 대표 배지 정렬. 낮을수록 우선.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'badge_visible'
  ) then
    alter table public.product_taxonomies add column badge_visible boolean not null default true;
    comment on column public.product_taxonomies.badge_visible is '상품 카드 대표 배지로 노출할지 여부.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'badge_tone'
  ) then
    alter table public.product_taxonomies add column badge_tone text not null default 'neutral';
    comment on column public.product_taxonomies.badge_tone is '카드 배지 스타일: primary | highlight | neutral';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_taxonomies' and column_name = 'badge_description'
  ) then
    alter table public.product_taxonomies add column badge_description text;
    comment on column public.product_taxonomies.badge_description is '카드 대표 배지용 1줄 설명(피치).';
  end if;
end $$;

-- 기존 campaign 행: 이름 기반 초기 매핑 (이미 값이 있으면 유지)
update public.product_taxonomies
set
  badge_priority = case lower(trim(name))
    when '추천' then 1
    when '인기' then 2
    when '신규' then 3
    else badge_priority
  end,
  badge_tone = case lower(trim(name))
    when '추천' then 'primary'
    when '인기' then 'highlight'
    when '신규' then 'neutral'
    else badge_tone
  end
where coalesce(taxonomy_type, '') = 'campaign';
