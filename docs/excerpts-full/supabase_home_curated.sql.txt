-- Home curated: 설정 + 섹션 + 섹션별 상품 (기존 is_featured_home와 별도)

create table if not exists public.home_curated_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null,
  section_label text not null default '',
  section_title text not null default '',
  section_description text not null default '',
  catalog_button_label text not null default '',
  catalog_button_href text not null default '/products',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_curated_settings_setting_key_key unique (setting_key)
);

alter table public.home_curated_settings add column if not exists setting_key text;
alter table public.home_curated_settings add column if not exists section_label text not null default '';
alter table public.home_curated_settings add column if not exists section_title text not null default '';
alter table public.home_curated_settings add column if not exists section_description text not null default '';
alter table public.home_curated_settings add column if not exists catalog_button_label text not null default '';
alter table public.home_curated_settings add column if not exists catalog_button_href text not null default '/products';
alter table public.home_curated_settings add column if not exists is_active boolean not null default true;
alter table public.home_curated_settings add column if not exists created_at timestamptz not null default now();
alter table public.home_curated_settings add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_home_curated_settings_key on public.home_curated_settings(setting_key);
create index if not exists idx_home_curated_settings_active on public.home_curated_settings(is_active);

create table if not exists public.home_curated_sections (
  id uuid primary key default gen_random_uuid(),
  setting_id uuid not null references public.home_curated_settings(id) on delete cascade,
  title text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  max_items integer not null default 8,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.home_curated_sections add column if not exists setting_id uuid;
alter table public.home_curated_sections add column if not exists title text not null default '';
alter table public.home_curated_sections add column if not exists description text not null default '';
alter table public.home_curated_sections add column if not exists sort_order integer not null default 0;
alter table public.home_curated_sections add column if not exists max_items integer not null default 8;
alter table public.home_curated_sections add column if not exists is_active boolean not null default true;
alter table public.home_curated_sections add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'home_curated_sections_setting_id_fkey'
  ) then
    alter table public.home_curated_sections
    add constraint home_curated_sections_setting_id_fkey
    foreign key (setting_id) references public.home_curated_settings(id) on delete cascade;
  end if;
end $$;

create index if not exists idx_home_curated_sections_setting on public.home_curated_sections(setting_id);
create index if not exists idx_home_curated_sections_sort on public.home_curated_sections(sort_order asc, created_at asc);
create index if not exists idx_home_curated_sections_active on public.home_curated_sections(is_active);

create table if not exists public.home_curated_section_products (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.home_curated_sections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(section_id, product_id)
);

alter table public.home_curated_section_products add column if not exists section_id uuid;
alter table public.home_curated_section_products add column if not exists product_id uuid;
alter table public.home_curated_section_products add column if not exists sort_order integer not null default 0;
alter table public.home_curated_section_products add column if not exists is_active boolean not null default true;
alter table public.home_curated_section_products add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'home_curated_section_products_section_id_fkey'
  ) then
    alter table public.home_curated_section_products
    add constraint home_curated_section_products_section_id_fkey
    foreign key (section_id) references public.home_curated_sections(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'home_curated_section_products_product_id_fkey'
  ) then
    alter table public.home_curated_section_products
    add constraint home_curated_section_products_product_id_fkey
    foreign key (product_id) references public.products(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'home_curated_section_products_section_id_product_id_key'
  ) then
    alter table public.home_curated_section_products
    add constraint home_curated_section_products_section_id_product_id_key unique(section_id, product_id);
  end if;
end $$;

create index if not exists idx_home_curated_section_products_section on public.home_curated_section_products(section_id);
create index if not exists idx_home_curated_section_products_product on public.home_curated_section_products(product_id);
create index if not exists idx_home_curated_section_products_sort on public.home_curated_section_products(section_id, sort_order asc, created_at asc);
create index if not exists idx_home_curated_section_products_active on public.home_curated_section_products(is_active);

-- 기본 설정 1건 upsert
insert into public.home_curated_settings (
  setting_key,
  section_label,
  section_title,
  section_description,
  catalog_button_label,
  catalog_button_href,
  is_active
) values (
  'home_curated',
  'THEALL CURATED PICKS',
  '이번 달 선별 추천 여행',
  '쇼핑몰식 전체 나열이 아닌, 더올투어가 직접 선별한 코스 중심의 추천 상품입니다.',
  '전체 상품 카탈로그 보기',
  '/products',
  true
)
on conflict (setting_key) do update set
  section_label = excluded.section_label,
  section_title = excluded.section_title,
  section_description = excluded.section_description,
  catalog_button_label = excluded.catalog_button_label,
  catalog_button_href = excluded.catalog_button_href,
  is_active = excluded.is_active,
  updated_at = now();
