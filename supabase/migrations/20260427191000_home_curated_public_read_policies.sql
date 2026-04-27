do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'home_curated_settings'
  ) then
    alter table public.home_curated_settings enable row level security;
    drop policy if exists "home_curated_settings_select_anon" on public.home_curated_settings;
    create policy "home_curated_settings_select_anon" on public.home_curated_settings
      for select to anon
      using (
        setting_key = 'home_curated'
        and is_active = true
      );
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'home_curated_sections'
  ) then
    alter table public.home_curated_sections enable row level security;
    drop policy if exists "home_curated_sections_select_anon" on public.home_curated_sections;
    create policy "home_curated_sections_select_anon" on public.home_curated_sections
      for select to anon
      using (
        is_active = true
        and exists (
          select 1
          from public.home_curated_settings s
          where s.id = home_curated_sections.setting_id
            and s.setting_key = 'home_curated'
            and s.is_active = true
        )
      );
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'home_curated_section_products'
  ) then
    alter table public.home_curated_section_products enable row level security;
    drop policy if exists "home_curated_section_products_select_anon" on public.home_curated_section_products;
    create policy "home_curated_section_products_select_anon" on public.home_curated_section_products
      for select to anon
      using (
        is_active = true
        and exists (
          select 1
          from public.home_curated_sections sec
          join public.home_curated_settings s on s.id = sec.setting_id
          where sec.id = home_curated_section_products.section_id
            and sec.is_active = true
            and s.setting_key = 'home_curated'
            and s.is_active = true
        )
      );
  end if;
end $$;
