# PR3: 마이페이지 리뷰 관리 3분할 + eligibility 기반 사용자 노출 — 결과 정리

## 1. 수정 파일 목록

| 구분 | 파일 |
|------|------|
| **수정** | `src/types/review.ts` |
| **수정** | `src/lib/reviewEligibilities.ts` |
| **수정** | `src/lib/reviews.ts` |
| **수정** | `src/app/mypage/reviews/page.tsx` |
| **수정** | `src/app/reviews/write/page.tsx` |
| **수정** | `src/components/ReviewWriteForm.tsx` |
| **추가** | `src/lib/mypageReviews.ts` |
| **추가** | `src/app/mypage/reviews/[id]/page.tsx` |
| **추가** | `docs/PR3-result.md` (본 문서) |

---

## 2. 각 파일별 변경 목적

| 파일 | 변경 목적 |
|------|------------|
| `src/types/review.ts` | `ReviewStatus` 타입 추가, `Review`에 `status` optional 필드 추가. 마이페이지용 카드 타입 `MyPageWritableReviewItem`, `MyPageDraftReviewItem`, `MyPageSubmittedReviewItem` 추가. |
| `src/lib/reviewEligibilities.ts` | `getWritableEligibilitiesByMemberId` (travel_bookings join 포함), `getEligibilityById` 함수 추가. `WritableEligibilityWithBooking` 확장 타입 추가. |
| `src/lib/reviews.ts` | `getSubmittedReviewsByMemberId`, `getDraftReviewsByMemberId`, `getReviewById`, `getReviewByEligibilityId` 함수 추가. draft는 DB에 status 컬럼 없어서 빈 배열 반환. |
| `src/lib/mypageReviews.ts` | **신규.** `getMyPageReviewSections(memberId)` → writable/drafts/submitted 3섹션 데이터를 한 번에 조회. |
| `src/app/mypage/reviews/page.tsx` | 3섹션 구조로 전면 개편. 작성 가능 / 작성 중 / 작성 완료 섹션별 카드 UI, 빈 상태 처리. |
| `src/app/reviews/write/page.tsx` | `searchParams`에서 `eligibility`, `review` 파라미터 파싱. 유효하지 않은 eligibility 또는 이미 제출된 건 경고 표시. |
| `src/components/ReviewWriteForm.tsx` | `eligibilityId`, `reviewId` props 추가. POST 시 `eligibility_id` 전달. |
| `src/app/mypage/reviews/[id]/page.tsx` | **신규.** 리뷰 상세보기 페이지. 본인 리뷰만 접근 가능, 제목/작성자/작성일/평점/이미지/본문 표시. |

---

## 3. /mypage/reviews 3섹션 구조 설명

### 섹션 1: 작성 가능한 후기

- **헤더:** "작성 가능한 후기" / "여행을 마친 상품의 후기를 작성할 수 있습니다."
- **데이터 소스:** `review_eligibilities` 중 `claimed_by_member_id = 현재 memberId`, `status in ('eligible', 'claimed')`, 아직 `reviews`에 해당 `eligibility_id`로 제출된 건이 없는 것
- **카드 표시:** 상품명, 여행일정, 후기 가능일, 상태 배지(작성 가능), [후기 작성] 버튼
- **링크:** `/reviews/write?eligibility=<eligibility_id>`

### 섹션 2: 작성 중인 후기

- **헤더:** "작성 중인 후기" / "임시저장된 후기를 이어서 작성하세요."
- **데이터 소스:** `reviews` 중 `member_id = 현재 memberId`, `status = 'draft'`
- **현재 상태:** DB에 `status` 컬럼이 없으므로 항상 빈 배열. 섹션은 표시되지만 "임시저장된 후기가 없습니다." 메시지만 노출.
- **카드 표시(미래):** 제목(또는 대체 문구), 마지막 저장일, 상태 배지(작성 중), [이어쓰기] 버튼

### 섹션 3: 작성 완료 후기

- **헤더:** "작성 완료 후기" / "이미 등록한 후기를 확인할 수 있습니다."
- **데이터 소스:** `reviews` 중 `member_id = 현재 memberId` (기존 `getReviewsByMemberId` 활용)
- **카드 표시:** 제목, 작성일, 평점, 본문 일부(2줄), [보기] 버튼
- **링크:** `/mypage/reviews/<review_id>`

### 빈 상태 처리

- **전체 데이터 없을 때:** "아직 연결된 후기 항목이 없습니다." + "여행 완료 후 후기를 남길 수 있는 상품이 여기에 표시됩니다."
- **섹션별 0건:** 각 섹션 아래에 간단한 빈 메시지 표시

---

## 4. writable / draft / submitted 데이터 기준

| 섹션 | 조건 |
|------|------|
| **writable** | `review_eligibilities.claimed_by_member_id = memberId` AND `status IN ('eligible', 'claimed')` AND `reviews.eligibility_id`로 제출된 리뷰 없음 |
| **draft** | `reviews.member_id = memberId` AND `status = 'draft'` (현재 미지원, 빈 배열) |
| **submitted** | `reviews.member_id = memberId` (기존 리뷰 전체, status 컬럼 없으므로 모두 submitted 간주) |

---

## 5. eligibility 기반 링크 처리 방식

### 마이페이지 → 후기 작성 진입

1. 작성 가능한 후기 카드에서 [후기 작성] 클릭
2. `/reviews/write?eligibility=<eligibility_id>` 로 이동
3. `page.tsx`에서 `eligibilityId` 파싱 후 유효성 검증
   - `getEligibilityById(eligibilityId)` 로 존재 여부 확인
   - `getReviewByEligibilityId(eligibilityId)` 로 이미 제출 여부 확인
4. 유효하지 않으면 경고 메시지, 이미 제출됐으면 안내 메시지
5. 정상이면 `ReviewWriteForm`에 `eligibilityId` 전달
6. POST `/api/reviews` 시 `eligibility_id` 포함

### 후속 PR에서 할 일

- POST `/api/reviews`에서 `eligibility_id` 받아서 `reviews.eligibility_id`에 저장
- eligibility 상태를 `submitted`로 업데이트
- booking_id, customer_profile_id 자동 연결

---

## 6. 리뷰 상세보기 처리 여부

**구현 완료.**

- 라우트: `/mypage/reviews/[id]`
- 표시 내용: 제목, 작성자, 작성일, 평점, 이미지(복수), 본문
- 권한: 본인 리뷰만 접근 가능 (`review.member_id === session.memberId`)
- 비정상 접근(다른 사람 리뷰, 없는 리뷰): `notFound()` 반환

---

## 7. 타입/유틸 변경 내용

### 타입 추가 (`src/types/review.ts`)

```typescript
export type ReviewStatus = "draft" | "submitted" | "hidden";

export type MyPageWritableReviewItem = {
  eligibility_id: string;
  booking_id: string;
  customer_profile_id: string;
  product_id: string | null;
  product_title: string | null;
  departure_date: string | null;
  return_date: string | null;
  review_open_at: string;
  has_submitted_review?: boolean;
};

export type MyPageDraftReviewItem = {
  review_id: string;
  eligibility_id?: string;
  title: string | null;
  updated_at?: string;
  created_at?: string;
};

export type MyPageSubmittedReviewItem = {
  id: string;
  title: string;
  content: string;
  created_at?: string;
  rating?: number;
  image_urls?: string[];
};
```

### 유틸 추가

| 파일 | 함수 |
|------|------|
| `reviewEligibilities.ts` | `getWritableEligibilitiesByMemberId`, `getEligibilityById` |
| `reviews.ts` | `getSubmittedReviewsByMemberId`, `getDraftReviewsByMemberId`, `getReviewById`, `getReviewByEligibilityId` |
| `mypageReviews.ts` | `getMyPageReviewSections` |

---

## 8. draft/status 관련 제약사항 또는 TODO

### 현재 제약

- `reviews` 테이블에 `status` 컬럼이 **없음** (스키마: id, member_id, author_name, title, content, created_at)
- 따라서 `getDraftReviewsByMemberId`는 항상 빈 배열 반환
- 모든 기존 리뷰는 `submitted`로 간주

### TODO

1. **reviews 테이블에 status 컬럼 추가 마이그레이션**
   ```sql
   ALTER TABLE reviews ADD COLUMN status text DEFAULT 'submitted';
   ```
2. `getDraftReviewsByMemberId`에서 `.eq("status", "draft")` 필터 추가
3. 후기 작성 폼에 임시저장 기능 구현 (POST with `status: 'draft'`)
4. 작성 중인 후기 이어쓰기 시 `reviewId` 파라미터로 기존 draft 로딩

---

## 9. 테스트 시나리오

### 시나리오 1: 마이페이지 리뷰 목록 3섹션 확인

1. 로그인 후 `/mypage/reviews` 접속
2. 3개 섹션이 표시되는지 확인: 작성 가능한 후기, 작성 중인 후기, 작성 완료 후기
3. 데이터 없을 때 빈 상태 메시지가 각 섹션에 적절히 표시되는지 확인

### 시나리오 2: 작성 가능한 후기 표시

1. 관리자에서 문의 → 예약 확정 → 여행 완료 처리 (PR2 플로우)
2. 해당 review_eligibility의 `claimed_by_member_id`를 테스트 회원 ID로 설정
3. 마이페이지에서 "작성 가능한 후기" 섹션에 해당 항목이 표시되는지 확인
4. 상품명, 여행일정, 후기 가능일이 올바르게 표시되는지 확인

### 시나리오 3: 후기 작성 진입

1. 작성 가능한 후기 카드에서 [후기 작성] 클릭
2. `/reviews/write?eligibility=<id>` 로 이동 확인
3. ReviewWriteForm이 정상 표시되는지 확인
4. 후기 제출 후 마이페이지에서 "작성 가능한 후기"에서 사라지고 "작성 완료 후기"에 표시되는지 확인

### 시나리오 4: 유효하지 않은 eligibility 접근

1. 존재하지 않는 eligibility ID로 `/reviews/write?eligibility=invalid-uuid` 접속
2. "유효하지 않은 후기 작성 링크입니다." 경고 표시 확인

### 시나리오 5: 이미 제출된 eligibility 접근

1. 이미 후기를 제출한 eligibility ID로 접속
2. "이미 후기를 작성한 여행건입니다." 경고 표시 확인

### 시나리오 6: 리뷰 상세보기

1. 작성 완료 후기 카드에서 [보기] 클릭
2. `/mypage/reviews/<id>` 로 이동
3. 제목, 작성자, 작성일, 평점, 이미지, 본문이 올바르게 표시되는지 확인

### 시나리오 7: 다른 사람 리뷰 접근 차단

1. 다른 회원의 review ID로 `/mypage/reviews/<other-id>` 직접 접속
2. 404 페이지가 표시되는지 확인

---

## 10. 남은 TODO

### 후속 PR4: claim/token 연결

- claim 토큰 기반 eligibility 연결 플로우 구현
- 비로그인 고객이 후기 작성 권한을 claim하는 UX

### reviews 테이블 확장

- `status` 컬럼 추가 (draft/submitted/hidden)
- `eligibility_id`, `booking_id`, `customer_profile_id` 컬럼 추가 마이그레이션 (현재 코드에는 있지만 기존 스키마에 없을 수 있음)

### 임시저장 기능

- 후기 작성 중 임시저장 버튼
- draft 상태 리뷰 로딩/이어쓰기

### POST /api/reviews 확장

- `eligibility_id` 받아서 저장
- eligibility 상태를 `submitted`로 업데이트
- booking_id, customer_profile_id 자동 연결

### 자유 작성 vs eligibility 작성 정책

- 현재 `/reviews/write` 직접 접속 시 자유 작성 가능
- 마이페이지에서는 eligibility 기반만 노출
- 장기적으로 자유 작성 제한 여부 결정 필요
