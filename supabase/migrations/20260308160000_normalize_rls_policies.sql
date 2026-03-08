-- =============================================================================
-- Phase 2 PR10-A: RLS 정책명·범위 정리 (point_ledger / reward_redemptions / reviews)
-- =============================================================================
--
-- 목적:
--   point_ledger, reward_redemptions, reviews 테이블의 RLS 정책을
--   baseline/migration 기준으로 통일합니다. (정책명·범위만 정리, 테이블/컬럼 변경 없음)
--
-- 이번 migration에서 다루지 않는 것 (의도적 제외):
--   - products / product_* : 정책 정리는 PR10-B 또는 별도 단계에서 수행.
--   - reward_redemption(단수) : PR7 이후 테이블 정리 대상이므로 정책을 건드리지 않음.
--   - travel_bookings : 20260305110000에서 anon 직접 접근 차단을 위해 정책 제거된 이력이 있음.
--     baseline에는 travel_bookings_all_anon 이 있으나, 현재 의도와 충돌 가능성이 있어
--     이번 PR에서는 travel_bookings RLS 정책을 변경하지 않음. (주석으로만 제외 사유 명시)
--
-- ⚠️ 실행 전 권장 사항:
--   - 정책 변경은 앱의 DB 접근성에 영향을 줄 수 있으므로, 적용 전 백업을 권장합니다.
--   - 가능하면 스테이징/개발 환경에서 먼저 적용·검증 후 운영에 반영하세요.
--   - destructive 변경(drop policy / create policy)이 포함되어 있습니다.
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) public.point_ledger
--    레거시: "Allow anon select point_ledger", "Allow anon insert point_ledger" (분리 정책)
--    목표: 단일 정책 "Allow anon point_ledger" (for all to anon)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'point_ledger') then
    -- 레거시 분리 정책 제거 (archive members_points_rewards.sql 유래)
    drop policy if exists "Allow anon select point_ledger" on public.point_ledger;
    drop policy if exists "Allow anon insert point_ledger" on public.point_ledger;
    -- 통일 정책: 기존 단일 정책이 있으면 제거 후 재생성
    drop policy if exists "Allow anon point_ledger" on public.point_ledger;
    create policy "Allow anon point_ledger" on public.point_ledger
      for all to anon using (true) with check (true);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2) public.reward_redemptions
--    목표: 단일 정책 "Allow anon reward_redemptions" (for all to anon)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'reward_redemptions') then
    drop policy if exists "Allow anon reward_redemptions" on public.reward_redemptions;
    create policy "Allow anon reward_redemptions" on public.reward_redemptions
      for all to anon using (true) with check (true);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3) public.reviews
--    목표: baseline 기준 read / insert / update 세 정책으로 통일
--    - Allow public read reviews (select to anon)
--    - Allow public insert reviews (insert to anon)
--    - Allow public update reviews (update to anon)
--    delete 정책은 만들지 않음.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'reviews') then
    drop policy if exists "Allow public read reviews" on public.reviews;
    create policy "Allow public read reviews" on public.reviews
      for select to anon using (true);

    drop policy if exists "Allow public insert reviews" on public.reviews;
    create policy "Allow public insert reviews" on public.reviews
      for insert to anon with check (true);

    drop policy if exists "Allow public update reviews" on public.reviews;
    create policy "Allow public update reviews" on public.reviews
      for update to anon using (true) with check (true);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 4) public.travel_bookings — 이번 PR 범위에서 제외
-- -----------------------------------------------------------------------------
-- travel_bookings RLS 정책은 과거 의도 충돌로 이번 PR 범위에서 제외합니다.
-- 20260305100000에서 "travel_bookings_all_anon" 생성 후,
-- 20260305110000에서 anon 직접 접근 차단 의도로 해당 정책을 제거했습니다.
-- baseline에는 travel_bookings_all_anon 이 정의되어 있으나, 현재는 anon 접근을
-- 허용하지 않는 방향으로 운영될 수 있으므로, 이번 migration에서는
-- travel_bookings 에 대한 정책 조작을 하지 않습니다.
-- (필요 시 별도 검토 후 migration 추가)
