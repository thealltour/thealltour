-- home_banners: API/관리자에서 사용하는 컬럼 보장 (image_url, mobile_image_url 등)
-- 기존 테이블에 컬럼이 없으면 추가. 이미 있으면 스킵.

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'home_banners'
  ) then
    create table public.home_banners (
      id uuid primary key default gen_random_uuid(),
      title text not null,
      image_url text not null,
      mobile_image_url text,
      link_url text,
      sort_order integer,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    );
    create index if not exists idx_home_banners_sort_order on public.home_banners(sort_order);
    create index if not exists idx_home_banners_is_active on public.home_banners(is_active);
    create index if not exists idx_home_banners_created_at on public.home_banners(created_at desc);
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'home_banners' and column_name = 'mobile_image_url'
  ) then
    alter table public.home_banners add column mobile_image_url text;
    comment on column public.home_banners.mobile_image_url is '모바일 배너 이미지 URL. 비우면 PC 이미지 사용.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'home_banners' and column_name = 'link_url'
  ) then
    alter table public.home_banners add column link_url text;
  end if;
end $$;
