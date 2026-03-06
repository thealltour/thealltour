# PR1 후속 작업 TODO (비로그인 상담 고객 기반 후기 시스템)

PR1에서 도메인/DB·타입·API 기반을 구축했습니다. 아래 항목은 후속 PR에서 진행합니다.

---

## 필수 TODO

1. **admin 문의 관리 화면에서 consultation_status / booking_status 편집 UI 추가**
   - 현재 API는 `PATCH /api/inquiries`, `PATCH /api/inquiries/[id]`에서 `consultation_status`, `booking_status`, `completed_at` 수신 가능.
   - 관리자 문의 목록/상세에서 드롭다운 또는 버튼으로 상태 변경할 수 있는 UI 추가.

2. **예약 확정 시 travel_booking 생성하는 관리자 액션 추가**
   - 문의 → 예약 확정 시 `travel_bookings` 1건 생성.
   - `lib/travelBookings.ts`의 `createTravelBooking` 활용. `inquiry_id`, `customer_profile_id`(문의에 연결된 프로필) 전달.

3. **여행 완료 시 review_eligibility 생성하는 관리자 액션 추가**
   - 예약 완료/여행 완료 처리 시 해당 `travel_booking`에 대해 `review_eligibilities` 1건 생성.
   - `lib/reviewEligibilities.ts`의 `createReviewEligibility` 활용.

4. **후기 claim 토큰 및 로그인 후 계정 연결 플로우 추가**
   - eligibility 기준으로 “후기 작성 링크”(토큰 포함) 발급.
   - 로그인/회원가입 후 `review_eligibilities.claimed_by_member_id` 연결 및 `customer_account_links` 연결.

5. **/reviews/write 를 eligibility 기반 진입 구조로 변경**
   - 현재는 회원 로그인만으로 작성 가능. 후속에서 eligibility(claim) 검증 후 작성 가능하도록 변경.

6. **마이페이지를 “작성 가능한 후기 / 작성 중 / 작성 완료” 3섹션으로 개편**
   - 작성 가능: claim된 eligibility 중 아직 제출 전.
   - 작성 중: 초안 저장(미구현 시 생략 가능).
   - 작성 완료: 기존 “내가 작성한 리뷰” 목록.

---

## 참고

- `is_completed`는 deprecated 예정이며, `consultation_status` / `booking_status` 중심으로 전환할 것.
- `reviews` 테이블에 `eligibility_id`, `booking_id`, `customer_profile_id` 컬럼은 후속 PR에서 추가 예정(현재는 타입만 확장).
