# Supabase 개발 환경 Reset / Reapply 가이드

**상태:** PR5 확정.  
**대상:** 개발/로컬/스테이징 환경. **운영 DB에는 이 문서의 reset 절차를 그대로 적용하지 마세요.**  
**관련 문서:** `docs/supabase-sql-inventory.md`, `docs/supabase-cleanup-plan.md`, `docs/supabase-app-schema-target.md`, `supabase/schema/README.md`.

---

## 1. 문서 목적

- 이 문서는 **개발 환경**(로컬·개발·스테이징)에서 Supabase DB를 **초기화(reset)한 뒤 다시 적용(reapply)** 하는 절차를 한곳에 정리한 실행 가능한 가이드입니다.
- **baseline.sql**, **migrations**, **optional schema**, **seed/테스트 포인트**를 한 문서에서 이해하고 따라할 수 있도록 합니다.
- **운영 DB가 아닌** 개발/로컬/스테이징 기준이며, 운영에 대한 destructive 작업은 다루지 않습니다.

---

## 2. 현재 source of truth 구조

| 경로 | 역할 | 비고 |
|------|------|------|
| `supabase/schema/baseline.sql` | **새 환경 0부터 재현용 기준본.** 앱이 기대하는 최종 스키마를 한 파일로 표현. destructive 변경(drop table/column) 없음. | PR3 결과물. PR4 migration으로 정합성 보정 전제. |
| `supabase/schema/optional_recommended_search_keywords.sql` | **선택 적용** 스키마. `public.recommended_search_keywords` 테이블 정의. 검색 추천 기능을 쓰는 환경이면 적용. | baseline 본문에 넣지 않고 별도 파일로 분리. |
| `supabase/migrations/*.sql` | baseline **이후** 정합성 보정·증분 반영. 타임스탬프 순서대로 적용. PR4 migration 4개 포함. | 기존 migration 수정·삭제 금지. |
| `supabase/archive/*.sql` | **이력·참조용.** 실행 대상 아님. PR9에서 이동한 과거 SQL(members_points_rewards, reviews_rating/image_upgrade, products_featured_home). | reset 시 **실행하지 말 것.** |
| `supabase/*.sql` (루트) | **참조·이력용.** members.sql, inquiries.sql, products_safe_upgrade.sql 등. | **source of truth 아님.** reset 시 **루트 SQL을 임의 순서로 전부 실행하지 말 것.** |
| `docs/supabase-app-schema-target.md` | 앱이 기대하는 목표 스키마·전환 포인트 명세. baseline·migration·코드 전환의 공통 기준. | PR2-A 결과 문서. |
| `docs/supabase-cleanup-plan.md` | PR1~PR5·Phase 2·PR9 설계안. drop/delete 금지 원칙, PR 순서, Phase 2 보류 항목. | 정리 작업의 상위 계획. |

**핵심 정리:**

- **baseline.sql** = 새 환경을 0부터 만들 때의 기준본.
- **migrations** = baseline 이후의 정합성 보정·증분 변경을 타임스탬프 순으로 반영.
- **archive/** = **이력·참조용.** 실행 대상이 아님. archive에 있는 SQL은 reset 시 **실행하지 말 것.**
- **루트 SQL** = 참조·이력용. reset 시 **baseline + optional(필요 시) + migrations** 순서를 따르고, **루트 SQL을 임의 순서로 전부 실행하지 말 것.**
- **recommended_search_keywords** = optional schema. 검색 추천 기능을 쓰는 환경에서만 적용.

---

## 3. 적용 전 체크리스트

- [ ] **환경 구분:** 지금 작업 대상이 **로컬 / 개발 / 스테이징** 중 어디인지 확인. **운영 DB에는 이 reset 절차를 바로 적용하지 말 것.**
- [ ] **운영 DB:** 운영 DB에는 reset을 적용하지 않음. 별도 백업·검토·배포 절차를 따름.
- [ ] **백업 여부:** 적용 전에 현재 DB 백업을 했는지 확인. (백업 대상은 §4 참고.)
- [ ] **핵심 테이블 상태:** point_ledger, reward_redemptions, reviews, travel_bookings 등이 이미 있는 환경이라면, PR4 migration 적용 여부와 컬럼 존재 여부를 점검.
- [ ] **reward_redemption(단수):** Phase 2 전까지 DB에 남아 있을 수 있음. 앱 코드는 PR2-B 완료로 reward_redemptions(복수) 기준으로 전환된 상태.
- [ ] **PR4 migration 적용 여부:** 이미 DB가 있는 경우, `20260308100000_normalize_point_ledger.sql` 등 PR4 migration 4개가 적용되었는지 확인.

---

## 4. 백업 대상

**원칙:** 가능하면 **public 스키마 전체** 백업. 최소한 아래 핵심 테이블은 백업 대상으로 둠.

**최소 백업 대상 테이블 예시:**

- members  
- point_ledger  
- reward_redemption (단수, 있으면)  
- reward_redemptions  
- reward_catalog  
- reviews  
- inquiries  
- travel_bookings  
- customer_profiles  
- review_eligibilities  
- point_earn_requests  
- earn_request_attachments  

**기타:** SQL Editor에서 수동 생성했을 수 있는 `recommended_search_keywords` 등도 환경에 따라 확인.

**구체 명령:** repo/팀 환경에 따라 다름. 예시만 안내하며, 확실하지 않은 명령은 단정적으로 쓰지 않음.

- Supabase 대시보드에서 **Database → Backups** 활용.  
- 또는 `pg_dump` / `supabase db dump` 등으로 public 스키마(또는 위 테이블만) 덤프.  
- 실제 사용할 명령은 팀 배포 문서 또는 Supabase 공식 문서를 참고.

---

## 5. 개발 환경 reset / reapply 권장 순서

가장 중요한 절. 아래 순서를 **지키는 것**이 권장됨.

1. **백업**  
   - §4에 따라 현재 DB 백업.

2. **새/비어 있는 개발 DB 준비**  
   - 로컬 Supabase 재시작 후 DB 초기화, 또는 새 개발/스테이징 프로젝트 생성 등.  
   - 기존 데이터를 버려도 되는 환경에서만 수행.

3. **baseline.sql 적용**  
   - 파일: `supabase/schema/baseline.sql`  
   - Supabase SQL Editor 또는 `psql` 등으로 **한 번에** 실행.  
   - 이 파일이 "0에서의 기준 상태"를 만듦.

4. **optional_recommended_search_keywords.sql 필요 시 적용**  
   - 파일: `supabase/schema/optional_recommended_search_keywords.sql`  
   - **검색 추천 기능을 쓰는 환경이면** 적용. 필수는 아님.

5. **migrations 타임스탬프 순서대로 적용**  
   - `supabase/migrations/` 아래 **파일명(타임스탬프) 순서대로** 실행.  
   - 순서 예시:
     - `20250304000000_points_rewards_v2.sql`
     - `20260304070000_point_earn_requests_step3.sql`
     - `20260305100000_customer_profiles_and_eligibility.sql`
     - `20260305110000_pr1_schema_rls_fix.sql`
     - `20260307100000_reviews_eligibility_columns.sql`
     - `20260307120000_review_claim_token.sql`
     - `20260307130000_reviews_draft_fields.sql`
     - **PR4:** `20260308100000_normalize_point_ledger.sql`
     - **PR4:** `20260308110000_normalize_reward_redemptions.sql`
     - **PR4:** `20260308120000_reconcile_reviews_columns.sql`
     - **PR4:** `20260308130000_fix_travel_bookings_inquiry_id.sql`

6. **seed/기초 데이터 반영(있는 경우)**  
   - `supabase/seed/` 또는 팀에서 쓰는 initial_data.sql 등이 있으면, 해당 절차에 따라 실행.  
   - 없으면 생략.

7. **앱 실행**  
   - `npm run dev` 등으로 앱 기동.

8. **기능 테스트**  
   - §6 적용 후 검증 체크리스트로 동작 확인.

**주의:**

- **baseline → optional(필요 시) → migrations** 순서를 지킴.
- **supabase/archive/** 안의 SQL은 **이력·참조용**이며 **실행 대상이 아님.** 실행하지 말 것.
- **기존 루트 SQL**(supabase/*.sql)을 **임의 순서로 전부 다시 실행하지 말 것.**  
  루트 SQL은 참조/이력용이며, 실행 순서와 중복 버전이 문서화되어 있지 않음.

---

## 6. 적용 후 검증 체크리스트

기능 단위로 확인. 가능하면 각 항목에 **확인 API/페이지**와 **확인할 DB 객체**를 함께 적음.

| 기능 | 확인 방법(API/페이지) | 확인할 DB 객체 |
|------|----------------------|----------------|
| 로그인/회원 | 로그인, 회원 정보 조회 | members |
| 문의 목록/상세 | `/api/inquiries`, 문의 상세 페이지 | inquiries |
| travel_bookings 연동 | 문의 상세에서 예약 생성/조회 | travel_bookings, inquiries.inquiry_id |
| 후기 자격 / claim token / 후기 작성 | 후기 자격 조회, claim, 후기 제출 | review_eligibilities, reviews |
| 포인트 지급 | 관리자 회원 포인트 지급 API | point_ledger(user_id, type, status), members.point_balance 또는 members.points |
| 포인트 내역 조회 | `/api/me/points`, `/api/members/me/points` | point_ledger |
| 경품 교환 신청 | 회원 경품 교환 신청 API | reward_redemptions, point_ledger(type=RESERVE) |
| 관리자 경품 승인/반려 | `/api/admin/reward-redemptions/[id]/approve`, reject | reward_redemptions, point_ledger(type=USE/RELEASE) |
| 리뷰 목록/작성/수정 | `/api/reviews`, 리뷰 작성·수정 페이지 | reviews |
| 추천 검색어 API | optional schema 적용 시 `/api/search/recommended` | recommended_search_keywords |
| 관리자 대시보드/집계 | 관리자 페이지, 문의/회원/리뷰 등 집계 | inquiries, members, reviews 등 |

---

## 7. 지금 시점에서 절대 삭제하면 안 되는 것

- **supabase/migrations 폴더 전체** — 적용 이력·재현 순서 추적에 필요. 삭제 금지.
- **supabase/archive/** — 이력·참조용. 삭제하면 과거 스키마 추적이 어려움. (실행은 하지 않음.)
- **supabase/*.sql 루트 파일들** — 참조·이력용. 삭제하면 "어떤 순서로 스키마가 만들어졌는지" 복원 불가.
- **reward_redemption(단수) 테이블** — Phase 2 전까지 DB에 남겨 둘 수 있음. drop 하지 않음.
- **point_ledger 레거시 컬럼(member_id, kind 등)** — 아직 DB에 남아 있을 수 있음. drop column 하지 않음.
- **src/types/pointsRewards.ts** — deprecated이지만 **즉시 삭제 대상 아님.** 호환용으로 유지.
- **optional schema 편입 전의 외부 생성 객체** — recommended_search_keywords 등이 SQL Editor 등으로만 만들어졌을 수 있음. 확인 없이 관련 기능 제거 금지.

---

## 8. known gaps / 주의사항

- **point_ledger 레거시 컬럼:** member_id, kind, balance_after 등은 아직 DB에 남아 있을 수 있음. 앱 코드는 PR2-B로 user_id, type, status 기준으로 전환된 상태.
- **reward_redemption(단수):** 앱 코드 전환은 PR2-B로 끝났지만, DB에서는 Phase 2 전까지 단수 테이블을 유지할 수 있음.
- **products:** baseline에는 최소 컬럼만 반영되어 있고, 전체 정합성 보정 대상은 아님. 루트의 products_*_upgrade 등과 차이가 있을 수 있음.
- **travel_bookings.inquiry_id:** 오래된 환경에서 bigint로 남아 있으면 수동 검토 필요. PR4 migration `20260308130000_fix_travel_bookings_inquiry_id.sql`에서 uuid/FK 보정.
- **RLS 정책명/범위:** 통일은 Phase 2 또는 별도 후속 작업. baseline과 기존 루트 SQL·migration과 정책명이 다를 수 있음.
- **recommended_search_keywords:** optional 적용 대상. 테이블이 없으면 추천 검색 API는 동작하지 않을 수 있음.

---

## 9. Phase 2 예고

아래는 **지금 하지 않는 일**로, 최종 검증 후 별도 Phase 2에서 검토.

- point_ledger 레거시 컬럼 **drop** (member_id, kind 등)
- reward_redemption(단수) 테이블 정리 (drop / view / data migration)
- deprecated 타입( pointsRewards.ts 등) **완전 삭제**
- 루트 SQL archive/정리 **(PR9에서 archive 이동·문서 정리 완료. 추가 정리는 PR10-A/B 등에서 검토.)**
- RLS 정책명/범위 정리
- products 전체 정합성 보정

---

## 10. 빠른 실행 요약

- **새 개발 환경에서 할 일:**  
  1) 백업(이미 데이터가 있다면).  
  2) **baseline.sql** 적용.  
  3) 검색 추천을 쓸 거면 **optional_recommended_search_keywords.sql** 적용.  
  4) **migrations**를 타임스탬프 순서대로 적용(PR4 4개 포함).  
  5) seed 있으면 적용 후 앱 실행·§6 검증.

- **optional:** recommended_search_keywords — 검색 추천 기능이 필요할 때만 optional SQL 적용.

- **하면 안 되는 것:**  
  - **운영 DB**에 이 reset 절차를 그대로 적용.  
  - **supabase/archive/** 안의 SQL 실행 (이력·참조용이며 실행 대상 아님).  
  - **루트 SQL**을 임의 순서로 전부 다시 실행.  
  - **migrations/ 루트 SQL/ archive/ reward_redemption 테이블/ point_ledger 레거시 컬럼/ pointsRewards.ts** 삭제.
