-- =============================================================================
-- PR4: reviews 컬럼 정합성 보정 (비파괴)
-- =============================================================================
--
-- 목적:
--   baseline 목표 컬럼에 맞춰 public.reviews 에 누락된 컬럼만 add column if not exists 로
--   보정하고, FK·인덱스를 없을 때만 추가합니다.
--
-- Destructive change를 하지 않는 이유:
--   기존 컬럼 제거/재정의/타입 변경 없음. image_urls not null 강제·정책 삭제 금지.
--
-- PR2-B / Phase 2:
--   구조만 맞추어 두며, RLS 정책 통일은 이번 PR에서 하지 않습니다.
--
-- =============================================================================

-- 컬럼 추가 (누락된 것만; 이미 있으면 no-op)
alter table public.reviews add column if not exists author_name text;
alter table public.reviews add column if not exists rating integer;
alter table public.reviews add column if not exists image_url text;
alter table public.reviews add column if not exists image_urls text[] default '{}';
alter table public.reviews add column if not exists eligibility_id uuid;
alter table public.reviews add column if not exists booking_id uuid;
alter table public.reviews add column if not exists customer_profile_id uuid;
alter table public.reviews add column if not exists status text default 'submitted';
alter table public.reviews add column if not exists updated_at timestamptz not null default now();
alter table public.reviews add column if not exists summary text;
alter table public.reviews add column if not exists content_good text;
alter table public.reviews add column if not exists content_bad text;
alter table public.reviews add column if not exists content_tip text;
alter table public.reviews add column if not exists rating_schedule integer;
alter table public.reviews add column if not exists rating_stay integer;
alter table public.reviews add column if not exists rating_guide integer;
alter table public.reviews add column if not exists rating_food integer;

-- FK 제약 (없을 때만 추가)
do $$
begin
  if not exists (select 1 from information_schema.table_constraints where table_schema = 'public' and table_name = 'reviews' and constraint_name = 'reviews_eligibility_id_fkey') then
    alter table public.reviews add constraint reviews_eligibility_id_fkey foreign key (eligibility_id) references public.review_eligibilities(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.table_constraints where table_schema = 'public' and table_name = 'reviews' and constraint_name = 'reviews_booking_id_fkey') then
    alter table public.reviews add constraint reviews_booking_id_fkey foreign key (booking_id) references public.travel_bookings(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.table_constraints where table_schema = 'public' and table_name = 'reviews' and constraint_name = 'reviews_customer_profile_id_fkey') then
    alter table public.reviews add constraint reviews_customer_profile_id_fkey foreign key (customer_profile_id) references public.customer_profiles(id) on delete set null;
  end if;
end $$;

-- 인덱스 (없으면 생성)
create unique index if not exists idx_reviews_eligibility_unique on public.reviews(eligibility_id) where eligibility_id is not null;
create index if not exists idx_reviews_eligibility_id on public.reviews(eligibility_id) where eligibility_id is not null;
create index if not exists idx_reviews_status on public.reviews(status);
create index if not exists idx_reviews_updated_at on public.reviews(updated_at desc);
create index if not exists idx_reviews_member_status on public.reviews(member_id, status);
