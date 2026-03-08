-- =============================================================================
-- Phase 2 PR10-B3: public.products RLS 정책만 정리
-- =============================================================================
--
-- 목적:
--   public.products 의 RLS 정책을 products_policies.sql 의도에 맞춰 통일합니다.
--   컬럼·인덱스·데이터는 전혀 건드리지 않습니다.
--
-- 왜 컬럼/데이터/인덱스를 건드리지 않는가:
--   PR10-B1(핵심 컬럼), PR10-B2(확장 컬럼)에서 스키마 정합성을 이미 보정했습니다.
--   이번 migration은 정책만 다루어 역할 분리를 명확히 합니다.
--
-- ⚠️ 공개 쓰기·삭제 권한에 대한 주의:
--   이 정책은 anon 역할에 대해 select/insert/update/delete 를 모두 허용합니다.
--   현재 앱은 서버 API를 통해 products 를 조회·수정하며, 클라이언트가 직접 anon으로
--   delete 하는 경로가 있다면 운영 환경에서 위험할 수 있습니다.
--   실행 전 스테이징에서 검증하고, 필요 시 향후 migration에서 delete 만 service role
--   또는 인증된 역할로 제한하는 등 정책을 강화할 수 있습니다.
--
-- =============================================================================

do $$
declare
  products_exists boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'products'
  ) into products_exists;

  if not products_exists then
    raise exception 'public.products 테이블이 없습니다. baseline.sql 또는 products_safe_upgrade.sql 적용 후 이 migration을 실행하세요.';
  end if;

  alter table public.products enable row level security;

  drop policy if exists "Allow public read products" on public.products;
  create policy "Allow public read products" on public.products
    for select to anon using (true);

  drop policy if exists "Allow public insert products" on public.products;
  create policy "Allow public insert products" on public.products
    for insert to anon with check (true);

  drop policy if exists "Allow public update products" on public.products;
  create policy "Allow public update products" on public.products
    for update to anon using (true) with check (true);

  drop policy if exists "Allow public delete products" on public.products;
  create policy "Allow public delete products" on public.products
    for delete to anon using (true);
end $$;
