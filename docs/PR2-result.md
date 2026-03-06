# PR2: 관리자 문의 관리 확장 — 결과 정리

## 1. 수정 파일 목록

| 구분 | 파일 |
|------|------|
| **수정** | `src/types/inquiry.ts` |
| **수정** | `src/app/api/inquiries/[id]/route.ts` |
| **수정** | `src/app/api/inquiries/route.ts` |
| **수정** | `src/lib/reviewEligibilities.ts` |
| **수정** | `src/lib/adminCounts.ts` |
| **수정** | `src/components/AdminInquiryTable.tsx` |
| **추가** | `docs/PR2-result.md` (본 문서) |

---

## 2. 각 파일별 변경 목적

| 파일 | 변경 목적 |
|------|------------|
| `src/types/inquiry.ts` | `ConsultationStatus`, `BookingStatus` 리터럴 타입 도입. `Inquiry`에 적용. `is_completed`는 하위호환용으로 유지·deprecated 표기. |
| `src/app/api/inquiries/[id]/route.ts` | PATCH를 action 기반으로 확장. `update_status` / `reserve_booking` / `complete_trip` 처리. 예약 확정 시 `travel_bookings` 생성, 여행 완료 시 `review_eligibilities` 자동 생성. 기존 단순 필드 PATCH 하위호환 유지. |
| `src/app/api/inquiries/route.ts` | GET 필터·정렬을 `consultation_status` / `booking_status` 기준으로 확장. status: all \| new \| contacted \| closed \| reserved \| completed \| pending. 요약에 `reservedCount`, `newCount`, `contactedCount`, `closedCount` 추가. 새 컬럼 없을 때 `is_completed` 기반 요약 폴백. |
| `src/lib/reviewEligibilities.ts` | `createEligibilityIfNotExists(bookingId, customerProfileId)` 추가. 이미 있으면 반환, 없으면 생성. |
| `src/lib/adminCounts.ts` | 집계를 `consultation_status` / `booking_status` 기준으로 전환. pending = `consultation_status.neq.closed` or `booking_status.eq.none`. completed = `booking_status.eq.completed`. reserved·delayed 집계 추가. 반환 shape에 `reservedInquiries` 추가. |
| `src/components/AdminInquiryTable.tsx` | UI를 상담/여행 상태 중심으로 개편. 상담 상태·여행 상태 배지, 행별 액션(상담중/상담종료, 예약 확정, 여행 완료), 예약 확정 모달, 상태 필터 확장. is_completed 체크·일괄 완료/미완료 버튼 제거. |

---

## 3. AdminInquiryTable 변경 전/후 핵심 차이

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| **상태 표시** | 상담여부 1컬럼(완료/미완료 체크박스) | 상담 상태(신규/상담중/상담종료) + 여행 상태(미확정/예약확정/여행완료/취소) 배지 2컬럼 |
| **행 액션** | 완료 체크박스 토글만 | 신규→상담중, 상담중→상담종료, [예약 확정], [여행 완료] 버튼 |
| **필터** | 전체/완료/미완료 | 전체/신규 문의/상담중/상담종료/예약확정/여행완료/미처리 |
| **일괄 처리** | 선택 완료·선택 미완료 버튼 | 제거 |
| **체크박스** | 행 선택 + 완료 체크 | 제거 |
| **예약 확정** | 없음 | [예약 확정] 클릭 시 모달 → 출발일·귀국일 입력 → PATCH `reserve_booking` |
| **여행 완료** | 없음 | booking_status=reserved 일 때만 [여행 완료] 표시 → PATCH `complete_trip` |
| **요약 문구** | 전체 N · 미완료 N · 완료 N | 전체 N · 미처리 N · 예약확정 N · 여행완료 N |

---

## 4. API action 설계

**PATCH /api/inquiries/[id]**

| action | body 예시 | 서버 동작 |
|--------|-----------|-----------|
| (없음, 하위호환) | `{ "consultation_status": "contacted" }` | inquiry만 해당 필드로 업데이트 |
| `update_status` | `{ "action": "update_status", "consultation_status": "closed" }` | inquiry의 consultation_status / booking_status / completed_at 만 업데이트 |
| `reserve_booking` | `{ "action": "reserve_booking", "departure_date": "2026-03-10", "return_date": "2026-03-13" }` | inquiry 조회 → customer_profile_id·기존 booking 확인 → travel_booking 생성 → inquiry를 consultation_status=closed, booking_status=reserved 로 업데이트 |
| `complete_trip` | `{ "action": "complete_trip" }` | inquiry·booking 조회(booking_status=reserved 확인) → travel_booking.booking_status=completed, travel_completed_at=now → inquiry.booking_status=completed, completed_at=now → createEligibilityIfNotExists |

**검증·에러**

- reserve_booking: customer_profile_id 없음 → 400. 이미 해당 inquiry로 booking 존재 → 400.
- complete_trip: booking_status !== reserved → 400. booking 없음 / customer_profile_id 없음 → 400.

---

## 5. travel_bookings 생성/완료 처리 로직

- **생성:** `reserve_booking` 시 `getTravelBookingByInquiryId(inquiryId)` 로 기존 유무 확인 → 없으면 `createTravelBooking({ customer_profile_id, inquiry_id, product_id, product_title, source_path, booking_status: "reserved", departure_date, return_date })` 호출. inquiry는 `consultation_status: "closed"`, `booking_status: "reserved"` 로 업데이트.
- **완료:** `complete_trip` 시 `getTravelBookingByInquiryId(inquiryId)` 로 booking 조회 → `updateTravelBookingStatus(booking.id, "completed", { travel_completed_at: now })` 호출. inquiry는 `booking_status: "completed"`, `completed_at: now` 로 업데이트.

---

## 6. review_eligibilities 생성 로직

- **createEligibilityIfNotExists(bookingId, customerProfileId)**  
  - `getEligibilityByBookingId(bookingId)` 로 존재 여부 확인.  
  - 있으면 해당 row 반환.  
  - 없으면 `createReviewEligibility({ booking_id, customer_profile_id, status: "eligible", review_open_at: now, review_deadline_at: null })` 호출 후 반환.
- **호출 시점:** `complete_trip` 처리 마지막에, inquiry·booking 업데이트 후 `createEligibilityIfNotExists(booking.id, inquiry.customer_profile_id)` 호출. 이미 있으면 스킵, 없으면 1건 생성.

---

## 7. adminCounts 집계 기준 변경 내용

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| **pendingInquiries** | `is_completed = false` | `consultation_status != 'closed' OR booking_status = 'none'` |
| **completedInquiries** | `total - pending` (is_completed 기반) | `booking_status = 'completed'` |
| **reservedInquiries** | 없음 | `booking_status = 'reserved'` |
| **delayedInquiries** | `is_completed = false` AND `created_at < 24h ago` | `consultation_status != 'closed'` AND `created_at < 24h ago` |
| **일별 delta** | 동일 로직, is_completed 기준 | 동일 로직, 새 pending/완료 기준 |

반환 shape는 기존 유지. `reservedInquiries` 필드 추가. `inquiryCount` = pendingCount 유지.

---

## 8. 테스트 시나리오

1. **상태 필터·정렬**  
   - 상태 필터: 전체/신규 문의/상담중/상담종료/예약확정/여행완료/미처리 선택 시 목록이 해당 조건으로만 나오는지 확인.  
   - 정렬: 최신순/오래된순/이름순/미처리 우선 동작 확인.

2. **상담 상태 변경**  
   - 신규 문의 행에서 [상담중] → consultation_status=contacted 반영 확인.  
   - 상담중 문의에서 [상담종료] → consultation_status=closed 반영 확인.

3. **예약 확정**  
   - booking_status=none·customer_profile_id 있는 문의에서 [예약 확정] → 모달에서 출발일·귀국일 입력 후 저장 → travel_bookings 1건 생성, inquiry가 consultation_status=closed, booking_status=reserved 로 바뀌는지 확인.  
   - 같은 문의로 다시 [예약 확정] 시도 시 “이미 이 문의로 예약이 등록되어 있습니다” 400 응답 확인.  
   - customer_profile_id 없는 문의에서 [예약 확정] 비활성 또는 에러 메시지 확인.

4. **여행 완료**  
   - booking_status=reserved 인 문의에서 [여행 완료] → inquiry.booking_status=completed, completed_at 설정, 해당 travel_booking.booking_status=completed·travel_completed_at 설정 확인.  
   - 동일 문의에 review_eligibilities 1건 생성(또는 이미 있으면 스킵) 확인.  
   - booking_status=none/completed 인 문의에는 [여행 완료] 버튼이 없거나 비활성인지 확인.

5. **대시보드 KPI**  
   - adminCounts 호출 시 pendingInquiries·completedInquiries·reservedInquiries·delayedInquiries 수치가 새 집계 기준과 일치하는지 확인.

6. **하위호환**  
   - PATCH [id]에 `action` 없이 `{ "consultation_status": "contacted" }` 만 보내서 inquiry만 업데이트되는지 확인.  
   - GET 요약에서 DB에 consultation_status/booking_status 컬럼이 없을 때 is_completed 기반 폴백으로 요약이 나오는지 확인(가능하다면 구 DB에서 1회 테스트).

---

## 9. 남은 TODO

- **후기 claim / 후기 작성 UX**  
  PR2 범위 아님. 후속 PR에서 eligibility 기반 claim·작성 플로우 구현.

- **is_completed 제거**  
  현재는 하위호환으로 유지. 관리자 UI·API·adminCounts가 모두 consultation_status/booking_status 중심으로 전환된 뒤, DB·타입·API에서 `is_completed` 제거 시점 정리.

- **예약 확정 폼 확장**  
  필요 시 product_id/product_title/source_path를 모달에서 수정 가능하도록 확장. 현재는 문의 값이 그대로 예약에 복사됨.

- **adminCounts 레거시 DB 폴백**  
  consultation_status/booking_status 컬럼이 없는 환경에서 adminCounts가 에러 없이 is_completed 기반으로 동작하도록 폴백 추가 가능.

- **후기 자격 “이미 생성됨” 표시**  
  booking_status=completed 이고 해당 booking에 eligibility가 있을 때 테이블에 “후기 자격 있음” 등 표시하려면, GET /api/inquiries에서 travel_booking·review_eligibility 존재 여부를 join/서브쿼리로 내려주거나 별도 API가 필요함. 현재는 미구현.
