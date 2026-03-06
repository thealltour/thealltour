-- PR1 보완: 스키마 정합성 및 RLS 축소
-- 1) travel_bookings.inquiry_id 를 inquiries.id(uuid)와 일치시키기
-- 2) 민감 테이블(customer_profiles, travel_bookings, review_eligibilities, customer_account_links) anon 정책 제거
-- 후속 PR에서 서버 API 또는 인증 기반 정책으로 재도입 예정

-- ---------------------------------------------------------------------------
-- 1) travel_bookings.inquiry_id: bigint → uuid
-- inquiries.id 가 uuid 이므로 FK 타입 일치. 이미 적용된 환경을 위해 alter 방식 사용.
-- ---------------------------------------------------------------------------
alter table public.travel_bookings drop constraint if exists travel_bookings_inquiry_id_fkey;
alter table public.travel_bookings drop column if exists inquiry_id;
alter table public.travel_bookings add column inquiry_id uuid references public.inquiries(id) on delete set null;

create index if not exists idx_travel_bookings_inquiry_id on public.travel_bookings(inquiry_id) where inquiry_id is not null;

comment on column public.travel_bookings.inquiry_id is '연결된 문의(inquiries.id). uuid.';

-- ---------------------------------------------------------------------------
-- 2) RLS: anon 전체 허용 제거 — 클라이언트 anon 직접 접근 차단, 서버 API 경유만 허용 예정
-- ---------------------------------------------------------------------------

-- customer_profiles
drop policy if exists "customer_profiles_insert_anon" on public.customer_profiles;
drop policy if exists "customer_profiles_select_anon" on public.customer_profiles;
drop policy if exists "customer_profiles_update_anon" on public.customer_profiles;
comment on table public.customer_profiles is '비로그인 상담 고객 마스터. 동일 전화번호/이메일 고객 묶음용. anon 직접 접근 차단. 후속 PR에서 서버 API 또는 인증 기반 정책 재도입 예정.';

-- travel_bookings
drop policy if exists "travel_bookings_all_anon" on public.travel_bookings;
comment on table public.travel_bookings is '여행 예약/완료 기준. customer_profile 기준 관리. anon 직접 접근 차단. 후속 PR에서 서버 API 또는 인증 기반 정책 재도입 예정.';

-- review_eligibilities
drop policy if exists "review_eligibilities_all_anon" on public.review_eligibilities;
comment on table public.review_eligibilities is '후기 작성 자격. 여행건 기준 생성, 회원 claim 시 claimed_by_member_id 연결. anon 직접 접근 차단. 후속 PR에서 서버 API 또는 인증 기반 정책 재도입 예정.';

-- customer_account_links
drop policy if exists "customer_account_links_all_anon" on public.customer_account_links;
comment on table public.customer_account_links is 'customer_profile ↔ member 연결. theall_member_auth / member_id(text) 기준. anon 직접 접근 차단. 후속 PR에서 서버 API 또는 인증 기반 정책 재도입 예정.';
