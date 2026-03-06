# PR1 보완 작업 결과 정리

## 1. 수정 파일 목록

| 구분 | 파일 경로 |
|------|------------|
| **추가** | `supabase/migrations/20260305110000_pr1_schema_rls_fix.sql` |
| **수정** | `src/lib/customerProfiles.ts` |
| **수정** | `src/lib/travelBookings.ts` |
| **수정** | `src/lib/reviewEligibilities.ts` |
| **수정** | `src/app/mypage/reviews/page.tsx` |
| **수정** | `src/app/api/inquiries/route.ts` |
| **수정** | `src/app/api/inquiries/[id]/route.ts` |
| **수정** | `src/components/AdminInquiryTable.tsx` |
| **수정** | `src/lib/adminCounts.ts` |
| **수정** | `src/types/inquiry.ts` |
| **추가** | `docs/PR1-remediation-result.md` (본 문서) |

---

## 2. 각 파일별 변경 목적

| 파일 | 변경 목적 |
|------|------------|
| `20260305110000_pr1_schema_rls_fix.sql` | travel_bookings.inquiry_id를 bigint → uuid로 수정하여 inquiries.id와 일치. customer_profiles, travel_bookings, review_eligibilities, customer_account_links의 anon RLS 정책 제거. |
| `src/lib/customerProfiles.ts` | RLS 차단 대비 supabase → supabaseAdmin 사용. 파일/함수 단위 TODO(가족 공용 번호, 이메일 보조 매칭, name/email 보정, race condition) 추가. 전화 실패 시 이메일 조회 fallback 추가. |
| `src/lib/travelBookings.ts` | RLS 차단 대비 supabase → supabaseAdmin 사용. |
| `src/lib/reviewEligibilities.ts` | RLS 차단 대비 supabase → supabaseAdmin 사용. |
| `src/app/mypage/reviews/page.tsx` | empty state에서 "여행후기 작성하기" CTA 제거. 문구만 유지. Link import 제거. |
| `src/app/api/inquiries/route.ts` | POST insert fallback 단계화(1차 전체 → 2차 quote_snapshot 제거 → 3차 customer_profile_id 제거 → 최종 최소 필드). 단계별 주석 및 console.error 로깅 추가. is_completed 관련 TODO 주석 추가. |
| `src/app/api/inquiries/[id]/route.ts` | is_completed 전환용 TODO 주석 추가. |
| `src/components/AdminInquiryTable.tsx` | consultation_status/booking_status 기반 개편 및 is_completed 제거 시점 TODO 주석 추가. |
| `src/lib/adminCounts.ts` | inquiries 집계를 consultation_status/booking_status 기준 전환 및 is_completed 제거 TODO 주석 추가. |
| `src/types/inquiry.ts` | is_completed 제거 시점 정리 TODO 주석 추가. |

---

## 3. 변경된 migration SQL 전문

**파일 경로:** `supabase/migrations/20260305110000_pr1_schema_rls_fix.sql`

```sql
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
```

---

## 4. 변경된 RLS 정책 SQL 전문

위 migration 파일에 포함됨. **추가된 정책 없음.** 기존 anon 정책만 제거됨.

제거된 정책 요약:

- **customer_profiles:** `customer_profiles_insert_anon`, `customer_profiles_select_anon`, `customer_profiles_update_anon`
- **travel_bookings:** `travel_bookings_all_anon`
- **review_eligibilities:** `review_eligibilities_all_anon`
- **customer_account_links:** `customer_account_links_all_anon`

RLS는 계속 활성화됨(`enable row level security` 유지). anon 역할에 대한 정책이 없으므로 위 4개 테이블에 대한 anon 직접 접근은 모두 차단됨. 서버는 `supabaseAdmin`(service_role)로 접근하므로 RLS를 우회하여 동작함.

---

## 5. /mypage/reviews 변경 내용

- **제거:** 리뷰 0건일 때 표시되던 "여행후기 작성하기" 버튼(Link to `/reviews/write`) 및 `Link` import.
- **유지:** "아직 작성한 후기가 없습니다.", "여행을 마친 뒤 후기를 남기면 이곳에서 관리할 수 있습니다." 문구만 표시.
- **의도:** 후기 자격(eligibility) 기반 구조에 맞게, 자유 작성 페이지로 유도하는 CTA를 제거하고 안내만 남김.

---

## 6. /api/inquiries fallback 변경 내용

**단계 구성:**

1. **1차:** 전체 payload(quote_snapshot, customer_profile_id, product_id, product_title, source_path 포함)로 insert.
2. **2차 실패 시:** `error.code === "42703"` 이고 quote_snapshot이 있으면, **quote_snapshot만 제거**한 payload로 재시도. product_id, product_title, source_path, customer_profile_id 유지. 성공 시 `console.error("[inquiries POST] fallback: quote_snapshot 제거 후 저장 성공", { code, message })` 로깅.
3. **여전히 inquiryId 없을 때:** **customer_profile_id만 제거**한 payload(product_*, source_path 유지)로 재시도. 성공 시 `console.error("[inquiries POST] fallback: customer_profile_id 제거 후 저장 성공", …)` 로깅.
4. **최종:** name, phone, content만 넣은 최소 insert. 실패 시 `console.error("[inquiries POST] fallback: 최소 필드 insert 실패", …)` 후 500 반환. 성공 시 `console.error("[inquiries POST] fallback: 최소 필드(name,phone,content)만 저장됨. product/customer_profile 등 유실 가능.")` 로깅.

**사용자 응답:** 기존과 동일. 성공 시 "문의가 저장되었습니다."(201), 최종 실패 시 "문의 저장에 실패했습니다."(500).

---

## 7. 추가된 TODO / 주석 목록

| 위치 | 내용 |
|------|------|
| `src/lib/customerProfiles.ts` 상단 | 현재 한계 및 후속 보완: 가족 공용 번호, 이메일 보조 매칭, name/email 보정, race condition. |
| `src/lib/customerProfiles.ts` findOrCreateCustomerProfile | TODO(후속 PR): (1) 가족 공용 번호 (2) 이메일 보조 매칭 (3) 기존 profile name/email 보정, 동시 요청 race condition. |
| `src/app/api/inquiries/route.ts` BulkPatchBody | TODO(후속 PR): 관리자 문의 UI를 consultation_status/booking_status 기반으로 개편 후 is_completed 제거. |
| `src/app/api/inquiries/route.ts` GET fallback | TODO(후속 PR): inquiry list filter/sort를 consultation_status/booking_status 기준으로 전환 후 fallback 정리. |
| `src/app/api/inquiries/route.ts` getInquirySummarySafe | TODO(후속 PR): consultation_status/booking_status 기준 집계로 전환 후 is_completed 제거. |
| `src/app/api/inquiries/[id]/route.ts` PatchBody 위 | TODO(후속 PR): 관리자 문의 UI를 consultation_status/booking_status 기반으로 개편 후 is_completed 제거. |
| `src/components/AdminInquiryTable.tsx` 상단 | TODO(후속 PR): 상담여부 필터/정렬/완료 토글을 consultation_status/booking_status 기반으로 개편. is_completed 제거 시점 정리. |
| `src/lib/adminCounts.ts` 상단 | TODO(후속 PR): inquiries 집계를 consultation_status/booking_status 기준으로 전환. is_completed 제거. |
| `src/types/inquiry.ts` is_completed | TODO(후속 PR): 관리자 UI·API·adminCounts 전환 완료 후 is_completed 제거 시점 정리. |
| Migration 파일 주석 | 후속 PR에서 서버 API 또는 인증 기반 정책 재도입 예정. |
| 테이블 comment (customer_profiles 등) | anon 직접 접근 차단. 후속 PR에서 서버 API 또는 인증 기반 정책 재도입 예정. |

---

## 8. 테스트 체크리스트

- [ ] **Migration 적용**  
  - `supabase/migrations/20260305110000_pr1_schema_rls_fix.sql` 적용 후 `travel_bookings.inquiry_id` 타입이 uuid인지 확인.  
  - 위 4개 테이블에 anon으로 직접 insert/select/update 불가한지 확인.

- [ ] **문의 저장**  
  - 상담 문의 폼 제출 시 1차 insert로 정상 저장되는지.  
  - DB에 customer_profile_id, product_id, product_title, source_path 등이 채워지는지.

- [ ] **문의 저장 fallback**  
  - (선택) quote_snapshot 또는 컬럼 누락 시뮬레이션 시 2차/3차/최종 fallback 동작 및 서버 로그에 `[inquiries POST] fallback` 메시지가 남는지 확인.

- [ ] **마이페이지 리뷰**  
  - 로그인 후 `/mypage/reviews` 접속 시 리뷰 없을 때 CTA 버튼 없이 안내 문구만 나오는지.  
  - 리뷰 있을 때 목록 정상 표시되는지.

- [ ] **관리자 문의**  
  - 관리자 문의 목록/필터/정렬/완료·미완료 토글이 기존처럼 동작하는지.  
  - PATCH 단건/일괄 동작 유지되는지.

- [ ] **관리자 대시보드**  
  - adminCounts(문의 건수 등)가 기존과 같이 노출되는지.

- [ ] **환경 변수**  
  - 서버에서 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있어 customer_profiles/travel_bookings/review_eligibilities 접근이 가능한지 확인.
