# PR13: 리뷰 리마인더 시스템 구축 - 결과 정리

## 1. Migration SQL

**파일**: `supabase/migrations/20260309100000_review_reminders.sql`

- 테이블 `review_reminders` 생성
  - `id` (uuid, PK)
  - `eligibility_id` (uuid, FK → review_eligibilities, ON DELETE CASCADE)
  - `member_id` (text, nullable) — claim 전에는 null, 추후 연동 시 사용
  - `reminder_type` (text, check: `reminder_3d` | `reminder_7d`)
  - `scheduled_at` (timestamptz)
  - `sent_at` (timestamptz, nullable)
  - `status` (text, default `scheduled`, check: `scheduled` | `sent` | `cancelled`)
  - `created_at` (timestamptz, default now())
- 인덱스: `idx_review_reminders_schedule`, `idx_review_reminders_member`, `idx_review_reminders_eligibility`, `idx_review_reminders_status`
- RLS: `review_reminders_service_role` (service_role 전체 허용)

---

## 2. Reminder 서비스 함수

**파일**: `src/lib/reviewReminders.ts`

| 함수 | 설명 |
|------|------|
| `createReviewReminders(eligibility)` | 여행 완료 시 호출. `travel_completed_at` 기준 3일/7일 후 `scheduled_at`으로 2건 insert. |
| `cancelReviewReminders(eligibility_id)` | 해당 eligibility의 `status = scheduled` 건만 `cancelled`로 업데이트. |
| `cancelReminderById(reminderId)` | 관리자용. 단일 리마인더(scheduled) 취소. |
| `getDueReviewReminders(limit)` | cron용. `scheduled_at <= now` 이고 `status = scheduled` 조회. |
| `markReminderSent(reminderId)` | 발송 처리: `status = sent`, `sent_at = now`. |
| `executeReminderSend(reminderId)` | 단건 발송 실행: eligibility 조회 → claim_link 구성 → 로그 출력 → `markReminderSent`. (추후 email/kakao 연동 지점) |
| `getReviewRemindersList({ status, limit, offset })` | 관리자 목록/필터/페이지네이션. |
| `getReviewReminderById(id)` | 단건 조회. |

---

## 3. complete_trip 연동

**파일**: `src/app/api/inquiries/[id]/route.ts`

- `body.action === "complete_trip"` 처리 시:
  - 기존: `updateTravelBookingStatus` → 문의 상태 업데이트 → `createEligibilityIfNotExists(..., { withClaimToken: true })`
  - **추가**: `eligibility`가 있으면 `createReviewReminders(eligibility)` 호출.
- `travel_completed_at`은 `updateTravelBookingStatus`로 이미 저장된 뒤이므로, `createReviewReminders` 내부에서 `getTravelBookingById(eligibility.booking_id)`로 조회해 3일/7일 계산.

---

## 4. 리뷰 제출 시 cancel 처리

**파일**: `src/app/api/reviews/route.ts`, `src/app/api/reviews/[id]/route.ts`

- **POST (route.ts)**  
  - 기존 draft 수정 후 제출 시: `updateEligibilityStatus(eligibilityId, "submitted")` 다음에 `cancelReviewReminders(eligibilityId)` 호출.  
  - 신규 insert 후 제출 시: `insertResult.data` 있고 `eligibilityId` 있으면 `cancelReviewReminders(eligibilityId)` 호출.
- **PATCH ([id]/route.ts)**  
  - `action === "submit"` 이고 `review.eligibility_id`가 있으면 `updateEligibilityStatus` 다음에 `cancelReviewReminders(review.eligibility_id)` 호출.

---

## 5. Cron worker 구현

**파일**: `src/app/api/cron/review-reminders/route.ts`

- **GET** only. (Vercel Cron에서 GET 호출 가정)
- 인증: `CRON_SECRET`이 설정되어 있으면 `Authorization: Bearer <CRON_SECRET>` 필수.
- 동작:
  1. `getDueReviewReminders(100)` 로 `scheduled_at <= now`, `status = scheduled` 조회.
  2. 각 건에 대해 `executeReminderSend(r.id)` 호출 (로그 + `markReminderSent`).
  3. 성공/실패 개수 반환: `{ processed, sent, failed }`.
- Idempotent: `markReminderSent`는 `status = scheduled`인 경우만 업데이트.

**Vercel 설정 예시** (`vercel.json`):

```json
{
  "crons": [{ "path": "/api/cron/review-reminders", "schedule": "*/10 * * * *" }]
}
```

(5~10분 주기 권장)

---

## 6. 관리자 UI

**페이지**: `/theall_manager_only/review-reminders`  
**파일**: `src/app/theall_manager_only/review-reminders/page.tsx`

- **API**: `GET /api/admin/review-reminders?status=&limit=&offset=`
- **테이블 컬럼**: eligibility_id, member_id, reminder_type, scheduled_at, sent_at, status.
- **필터**: 드롭다운 — 전체 / 예약됨(scheduled) / 발송됨(sent) / 취소됨(cancelled).
- **동작**:
  - **재발송**: `status === "scheduled"` 인 행에만 노출. `POST /api/admin/review-reminders/[id]` 호출 → 즉시 `executeReminderSend` 후 sent 처리.
  - **취소**: 같은 조건에서 `PATCH /api/admin/review-reminders/[id]` body `{ action: "cancel" }` → `cancelReminderById`.

**사이드바/서브메뉴**

- `sidebarConfig.tsx`: "후기 리마인더" 링크 추가 (Clock 아이콘, `mainKey: "reviews"`).
- `SubHeader.tsx`: 후기 메뉴에 "리마인더" 탭 추가, 클릭 시 `/theall_manager_only/review-reminders` 이동.
- `AdminLayout.tsx`: `review-reminders` 경로도 `reviews` 메뉴로 인식하도록 `inferMainMenuKey` 수정.

---

## 7. 정책 설명

- **생성**: 여행 완료(`complete_trip`) 시 해당 eligibility 기준 3일/7일 후 발송 예정으로 2건 생성.  
  - `scheduled_at` = `travel_bookings.travel_completed_at` + 3일 / + 7일.
- **취소**: 후기 제출(submitted) 시 해당 `eligibility_id`의 모든 `scheduled` 리마인더를 `cancelled`로 변경.  
  - 관리자에서도 단건 취소 가능.
- **발송**: Cron이 주기적으로 due 건을 조회해 `executeReminderSend` 실행.  
  - 현재는 콘솔 로그만 출력. 추후 동일 함수에서 이메일/카카오/알림 로그 연동 가능.
- **확장**: 14일/30일 등 추가 타입은 `reminder_type` 및 `createReviewReminders`에 항목 추가하면 됨.

---

## 8. 테스트 시나리오

1. **여행 완료**  
   - 문의에 대해 `PATCH /api/inquiries/[id]` body `{ action: "complete_trip" }` 호출.  
   - `review_eligibilities`에 1건 생성, `review_reminders`에 2건(reminder_3d, reminder_7d) 생성 확인.  
   - `scheduled_at`이 travel_completed_at + 3일, + 7일인지 확인.

2. **scheduled 확인**  
   - DB 또는 관리자 리마인더 페이지에서 상태 `scheduled`, `reminder_type`, `scheduled_at` 확인.

3. **리뷰 작성(제출)**  
   - 해당 eligibility로 후기 작성 후 `status = submitted`로 제출.  
   - 해당 eligibility_id의 리마인더가 모두 `cancelled`로 바뀌는지 확인.

4. **Cron 실행**  
   - `scheduled_at`을 과거로 넣은 scheduled 건이 있을 때 `GET /api/cron/review-reminders` (필요 시 `Authorization: Bearer <CRON_SECRET>`) 호출.  
   - 해당 건의 `status`가 `sent`, `sent_at`이 채워지는지 확인.  
   - 응답 `{ processed, sent, failed }` 확인.

5. **관리자 UI**  
   - `/theall_manager_only/review-reminders` 접속.  
   - 목록·필터(scheduled/sent/cancelled) 동작 확인.  
   - scheduled 건에 대해 재발송 → sent 처리, 취소 → cancelled 처리 확인.

---

## 수정/신규 파일 목록

| 구분 | 경로 |
|------|------|
| 신규 | `supabase/migrations/20260309100000_review_reminders.sql` |
| 신규 | `src/lib/reviewReminders.ts` |
| 신규 | `src/app/api/cron/review-reminders/route.ts` |
| 신규 | `src/app/api/admin/review-reminders/route.ts` |
| 신규 | `src/app/api/admin/review-reminders/[id]/route.ts` |
| 신규 | `src/app/theall_manager_only/review-reminders/page.tsx` |
| 수정 | `src/lib/travelBookings.ts` (getTravelBookingById 추가) |
| 수정 | `src/app/api/inquiries/[id]/route.ts` (createReviewReminders 연동) |
| 수정 | `src/app/api/reviews/route.ts` (cancelReviewReminders 연동) |
| 수정 | `src/app/api/reviews/[id]/route.ts` (cancelReviewReminders 연동) |
| 수정 | `src/components/admin/SubHeader.tsx` (리마인더 탭) |
| 수정 | `src/components/admin/AdminLayout.tsx` (review-reminders 경로 → reviews) |
| 수정 | `src/components/admin/sidebarConfig.tsx` (후기 리마인더 메뉴) |
