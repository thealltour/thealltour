# PR1 결과물 정리: 비로그인 상담 고객 기반 후기 시스템 도메인/DB 기반 구축

---

## 1. 추가/수정된 파일 목록

### 신규 추가
| 파일 | 설명 |
|------|------|
| `supabase/migrations/20260305100000_customer_profiles_and_eligibility.sql` | customer_profiles, travel_bookings, review_eligibilities, customer_account_links 생성 및 inquiries 확장 |
| `src/types/customerProfile.ts` | CustomerProfile / CustomerProfileInput 타입 |
| `src/types/travelBooking.ts` | TravelBooking / TravelBookingInput / TravelBookingStatus |
| `src/types/reviewEligibility.ts` | ReviewEligibility / ReviewEligibilityInput / ReviewEligibilityStatus |
| `src/types/customerAccountLink.ts` | CustomerAccountLink / CustomerAccountLinkInput |
| `src/lib/customerProfiles.ts` | normalizePhone, findCustomerProfileByPhone, createCustomerProfile, findOrCreateCustomerProfile |
| `src/lib/travelBookings.ts` | createTravelBooking, getTravelBookingByInquiryId, updateTravelBookingStatus |
| `src/lib/reviewEligibilities.ts` | createReviewEligibility, getEligibilityByBookingId, getEligibilitiesByMemberId |
| `docs/PR1-follow-up-todos.md` | 후속 PR 필수 TODO 6항목 |
| `docs/PR1-result-summary.md` | 본 결과물 정리 문서 |

### 수정
| 파일 | 변경 목적 |
|------|-----------|
| `src/types/inquiry.ts` | customer_profile_id, consultation_status, booking_status, completed_at 추가, is_completed deprecated 주석 |
| `src/types/review.ts` | eligibility_id, booking_id, customer_profile_id optional 추가 |
| `src/app/api/inquiries/route.ts` | POST 시 findOrCreateCustomerProfile 후 customer_profile_id 포함 저장, GET normalize 신규 필드 반영, PATCH consultation_status/booking_status 확장 및 is_completed deprecated |
| `src/app/api/inquiries/[id]/route.ts` | PATCH 시 consultation_status, booking_status, completed_at 업데이트 지원 |
| `src/lib/reviews.ts` | normalizeReview에 eligibility_id/booking_id/customer_profile_id 반영, getReviewsByMemberId 추가 |
| `src/app/mypage/reviews/page.tsx` | MOCK_REVIEWS 제거, 세션 회원 기준 실제 리뷰 조회 및 empty state |

---

## 2. 각 파일의 변경 목적

- **Migration**: 비로그인 고객 마스터(customer_profiles), 여행 예약/완료(travel_bookings), 후기 자격(review_eligibilities), 계정 연결(customer_account_links) 테이블 생성 및 inquiries에 customer_profile_id, consultation_status, booking_status, completed_at 추가. is_completed 컬럼 유지.
- **Types**: 신규 4개 도메인 타입 정의, inquiry/review 타입에 새 필드 및 deprecated 표시 추가.
- **Lib**: 고객 프로필 조회/생성(findOrCreate), 예약 생성/조회/상태 변경, 자격 생성/조회(member 기준 포함) 함수 제공.
- **Inquiries API**: 문의 저장 시 고객 프로필 연결, 목록/단건 응답에 새 상태 필드 포함, PATCH로 consultation_status/booking_status(및 completed_at) 업데이트 가능. 기존 is_completed 동작 유지.
- **Reviews**: 타입·normalize에 eligibility 관련 optional 필드 반영, 마이페이지용 getReviewsByMemberId 추가.
- **마이페이지 리뷰**: mock 제거, 로그인 회원의 실제 리뷰만 표시, 없을 때 empty state 및 후기 작성 링크 노출.
- **docs/PR1-follow-up-todos.md**: 후속 PR에서 진행할 6개 필수 TODO 정리.

---

## 3. DB migration SQL 전문

아래 내용은 `supabase/migrations/20260305100000_customer_profiles_and_eligibility.sql` 에 저장된 내용과 동일합니다.

```sql
-- PR1: 비로그인 상담 고객 기반 후기 시스템 도메인/DB 기반 구축
-- customer_profiles, travel_bookings, review_eligibilities, customer_account_links 신규
-- inquiries 테이블 확장 (customer_profile_id, consultation_status, booking_status, completed_at)

create extension if not exists "pgcrypto";

-- 1) customer_profiles
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

-- 2) travel_bookings
create table if not exists public.travel_bookings (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  inquiry_id uuid references public.inquiries(id) on delete set null,
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

-- 3) review_eligibilities
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

-- 4) customer_account_links
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

-- 5) inquiries 확장
alter table public.inquiries add column if not exists customer_profile_id uuid references public.customer_profiles(id) on delete set null;
alter table public.inquiries add column if not exists consultation_status text not null default 'new';
alter table public.inquiries add column if not exists booking_status text not null default 'none';
alter table public.inquiries add column if not exists completed_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'inquiries_consultation_status_check') then
    alter table public.inquiries add constraint inquiries_consultation_status_check check (consultation_status in ('new','contacted','closed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'inquiries_booking_status_check') then
    alter table public.inquiries add constraint inquiries_booking_status_check check (booking_status in ('none','reserved','completed','canceled'));
  end if;
end $$;
create index if not exists idx_inquiries_customer_profile_id on public.inquiries(customer_profile_id) where customer_profile_id is not null;
comment on column public.inquiries.customer_profile_id is '연결된 비로그인 고객 프로필';
comment on column public.inquiries.consultation_status is '상담 진행 상태: new, contacted, closed';
comment on column public.inquiries.booking_status is '예약/완료 상태: none, reserved, completed, canceled';
```

(실제 파일에는 `idx_customer_account_links_member_id` 생성 시 `if not exists` 가 들어가 있음. 위 요약에서는 동일 디렉터리 내 `20260305100000_customer_profiles_and_eligibility.sql` 참고.)

---

## 4. 핵심 타입 정의

- **CustomerProfile**: id, name, phone, email, source, created_at, updated_at  
- **TravelBooking**: id, customer_profile_id, inquiry_id, product_id, product_title, source_path, booking_status('reserved'|'completed'|'canceled'), departure_date, return_date, travel_completed_at, created_at, updated_at  
- **ReviewEligibility**: id, booking_id, customer_profile_id, status('eligible'|'claimed'|'submitted'|'expired'|'blocked'), review_open_at, review_deadline_at, claimed_by_member_id, claimed_at, created_at, updated_at  
- **CustomerAccountLink**: id, customer_profile_id, member_id, linked_by, verified_method, verified_at, created_at  
- **Inquiry (확장)**: 기존 필드 + customer_profile_id?, consultation_status?, booking_status?, completed_at?  
- **Review (확장)**: 기존 필드 + eligibility_id?, booking_id?, customer_profile_id?  

---

## 5. API 변경 사항

| API | 변경 내용 |
|-----|-----------|
| **POST /api/inquiries** | 저장 전 `findOrCreateCustomerProfile({ name, phone, source: 'inquiry' })` 호출 후, 생성된 프로필이 있으면 `customer_profile_id` 를 insert payload에 포함. 요청/응답 형식은 기존과 동일. |
| **GET /api/inquiries** | 응답 항목에 `customer_profile_id`, `consultation_status`, `booking_status`, `completed_at` 포함. 검색/필터/페이징 동작 유지. |
| **PATCH /api/inquiries** | body에 `consultation_status`('new'|'contacted'|'closed'), `booking_status`('none'|'reserved'|'completed'|'canceled') 추가. `ids` 와 함께 보내면 해당 id들에 일괄 반영. `is_completed` 도 계속 지원하되 deprecated. |
| **PATCH /api/inquiries/[id]** | body에 `consultation_status`, `booking_status`, `completed_at` 추가. 위와 동일한 값만 허용. `is_completed` 유지·deprecated. |

---

## 6. 마이페이지 리뷰 관리 변경 사항

- **MOCK_REVIEWS** 완전 제거.
- **데이터 소스**: `getMemberSessionFromCookies` 로 세션 확인 후, 세션이 있으면 `getReviewsByMemberId(session.memberId)` 로 해당 회원이 작성한 리뷰만 조회.
- **리스트**: 실제 리뷰만 카드 형태로 표시(제목, 작성일, 내용 일부).
- **empty state**: 리뷰가 없을 때 “아직 작성한 후기가 없습니다.”, “여행을 마친 뒤 후기를 남기면 이곳에서 관리할 수 있습니다.” 문구와 “여행후기 작성하기” 링크 노출.
- **상세보기 (준비중) 버튼** 제거.

---

## 7. 후속 PR을 위한 TODO 목록

`docs/PR1-follow-up-todos.md` 에 상세 기술. 요약:

1. admin 문의 관리 화면에 **consultation_status / booking_status** 편집 UI 추가  
2. 예약 확정 시 **travel_booking** 생성하는 관리자 액션 추가  
3. 여행 완료 시 **review_eligibility** 생성하는 관리자 액션 추가  
4. 후기 **claim 토큰** 및 **로그인 후 계정 연결** 플로우 추가  
5. **/reviews/write** 를 eligibility 기반 진입 구조로 변경  
6. 마이페이지를 **작성 가능한 후기 / 작성 중 / 작성 완료** 3섹션으로 개편  
