-- PR1: 비로그인 상담 고객 기반 후기 시스템 도메인/DB 기반 구축
-- customer_profiles, travel_bookings, review_eligibilities, customer_account_links 신규
-- inquiries 테이블 확장 (customer_profile_id, consultation_status, booking_status, completed_at)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1) customer_profiles
-- 비로그인 상담 고객을 운영 기준으로 식별하는 마스터 테이블
-- ---------------------------------------------------------------------------
create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  source text not null default 'inquiry',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_profiles_phone on public.customer_profiles(phone);
create index if not exists idx_customer_profiles_email on public.customer_profiles(email) where email is not null;

comment on table public.customer_profiles is '비로그인 상담 고객 마스터. 동일 전화번호/이메일 고객 묶음용.';

alter table public.customer_profiles enable row level security;

drop policy if exists "customer_profiles_insert_anon" on public.customer_profiles;
create policy "customer_profiles_insert_anon" on public.customer_profiles for insert to anon with check (true);
drop policy if exists "customer_profiles_select_anon" on public.customer_profiles;
create policy "customer_profiles_select_anon" on public.customer_profiles for select to anon using (true);
drop policy if exists "customer_profiles_update_anon" on public.customer_profiles;
create policy "customer_profiles_update_anon" on public.customer_profiles for update to anon using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 2) travel_bookings
-- 실제 여행 예약/완료 기준. customer_profile 기준 관리
-- inquiry_id: 실제 DB의 inquiries.id 타입에 맞춤 (uuid 또는 bigint)
-- ---------------------------------------------------------------------------
create table if not exists public.travel_bookings (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  inquiry_id bigint references public.inquiries(id) on delete set null,
  product_id text,
  product_title text,
  source_path text,
  booking_status text not null default 'reserved' check (booking_status in ('reserved','completed','canceled')),
  departure_date date,
  return_date date,
  travel_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_travel_bookings_customer_profile_id on public.travel_bookings(customer_profile_id);
create index if not exists idx_travel_bookings_inquiry_id on public.travel_bookings(inquiry_id) where inquiry_id is not null;

comment on table public.travel_bookings is '여행 예약/완료 기준. customer_profile 기준 관리.';

alter table public.travel_bookings enable row level security;

drop policy if exists "travel_bookings_all_anon" on public.travel_bookings;
create policy "travel_bookings_all_anon" on public.travel_bookings for all to anon using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 3) review_eligibilities
-- 후기 작성 자격. 여행건 기준 생성, 나중에 회원 claim 가능
-- ---------------------------------------------------------------------------
create table if not exists public.review_eligibilities (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.travel_bookings(id) on delete cascade,
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  status text not null default 'eligible' check (status in ('eligible','claimed','submitted','expired','blocked')),
  review_open_at timestamptz not null default now(),
  review_deadline_at timestamptz,
  claimed_by_member_id text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(booking_id)
);

create index if not exists idx_review_eligibilities_booking_id on public.review_eligibilities(booking_id);
create index if not exists idx_review_eligibilities_customer_profile_id on public.review_eligibilities(customer_profile_id);
create index if not exists idx_review_eligibilities_claimed_by_member_id on public.review_eligibilities(claimed_by_member_id) where claimed_by_member_id is not null;

comment on table public.review_eligibilities is '후기 작성 자격. 여행건 기준 생성, 회원 claim 시 claimed_by_member_id 연결.';

alter table public.review_eligibilities enable row level security;

drop policy if exists "review_eligibilities_all_anon" on public.review_eligibilities;
create policy "review_eligibilities_all_anon" on public.review_eligibilities for all to anon using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 4) customer_account_links
-- customer_profile ↔ member 연결 (현재 member session / member_id text 기준)
-- ---------------------------------------------------------------------------
create table if not exists public.customer_account_links (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  member_id text not null,
  linked_by text not null default 'self',
  verified_method text not null default 'manual',
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(customer_profile_id, member_id)
);

create index if not exists idx_customer_account_links_customer_profile_id on public.customer_account_links(customer_profile_id);
create index if not exists idx_customer_account_links_member_id on public.customer_account_links(member_id);

comment on table public.customer_account_links is 'customer_profile ↔ member 연결. theall_member_auth / member_id(text) 기준.';

alter table public.customer_account_links enable row level security;

drop policy if exists "customer_account_links_all_anon" on public.customer_account_links;
create policy "customer_account_links_all_anon" on public.customer_account_links for all to anon using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 5) inquiries 확장
-- customer_profile_id, consultation_status, booking_status, completed_at 추가
-- is_completed는 유지 (후에 deprecated 예정)
-- ---------------------------------------------------------------------------
alter table public.inquiries add column if not exists customer_profile_id uuid references public.customer_profiles(id) on delete set null;
alter table public.inquiries add column if not exists consultation_status text not null default 'new';
alter table public.inquiries add column if not exists booking_status text not null default 'none';
alter table public.inquiries add column if not exists completed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inquiries_consultation_status_check'
  ) then
    alter table public.inquiries add constraint inquiries_consultation_status_check
      check (consultation_status in ('new','contacted','closed'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'inquiries_booking_status_check'
  ) then
    alter table public.inquiries add constraint inquiries_booking_status_check
      check (booking_status in ('none','reserved','completed','canceled'));
  end if;
end $$;

create index if not exists idx_inquiries_customer_profile_id on public.inquiries(customer_profile_id) where customer_profile_id is not null;

comment on column public.inquiries.customer_profile_id is '연결된 비로그인 고객 프로필';
comment on column public.inquiries.consultation_status is '상담 진행 상태: new, contacted, closed';
comment on column public.inquiries.booking_status is '예약/완료 상태: none, reserved, completed, canceled';
