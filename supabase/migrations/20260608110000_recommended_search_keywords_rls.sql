-- recommended_search_keywords: 공개 SELECT(활성 키워드) + 관리자 CRUD(service_role) 분리.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'recommended_search_keywords'
  ) then
    alter table public.recommended_search_keywords enable row level security;

    drop policy if exists "recommended_search_keywords_select_anon" on public.recommended_search_keywords;
    drop policy if exists "recommended_search_keywords_all_anon" on public.recommended_search_keywords;

    create policy "recommended_search_keywords_select_anon"
      on public.recommended_search_keywords
      for select
      to anon, authenticated
      using (is_active = true);
  end if;
end $$;
