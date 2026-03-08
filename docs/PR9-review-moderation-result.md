# PR9: 리뷰 운영 시스템 구축 — 결과 정리

## 1. Migration SQL

**파일:** `supabase/migrations/20260308210000_review_reports.sql`

```sql
-- PR9: 리뷰 신고 테이블
-- 한 사용자당 동일 리뷰 1회만 신고 가능

CREATE TABLE IF NOT EXISTS public.review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  member_id text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  UNIQUE(review_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_review_reports_review_id
ON public.review_reports (review_id);

CREATE INDEX IF NOT EXISTS idx_review_reports_status
ON public.review_reports (status);

COMMENT ON TABLE public.review_reports IS '리뷰 신고. status: pending / resolved / dismissed';
```

- **테이블:** `review_reports`
- **필드:** `id`(uuid PK), `review_id`(uuid FK → reviews), `member_id`(text), `reason`(text), `created_at`(timestamptz), `status`(text, 기본값 'pending')
- **제약:** `UNIQUE(review_id, member_id)` — 동일 리뷰에 대해 회원당 1건만 허용
- **status:** `pending`(대기), `resolved`(처리완료), `dismissed`(무시)

---

## 2. 수정 파일 목록

| 구분 | 경로 |
|------|------|
| **신규** | `supabase/migrations/20260308210000_review_reports.sql` |
| **신규** | `src/app/api/reviews/[id]/report/route.ts` |
| **신규** | `src/app/api/admin/reviews/[id]/hide/route.ts` |
| **신규** | `src/app/api/admin/review-reports/[id]/route.ts` |
| **신규** | `src/components/reviews/ReviewReportModal.tsx` |
| **신규** | `src/components/reviews/ReviewCardReportButton.tsx` |
| **신규** | `src/components/reviews/ReviewDetailReportButton.tsx` |
| **신규** | `src/lib/adminReviewReports.ts` |
| **신규** | `src/components/admin/AdminReviewReportsTable.tsx` |
| **신규** | `src/app/admin/review-reports/page.tsx` |
| **신규** | `src/app/theall_manager_only/review-reports/page.tsx` |
| **수정** | `src/types/review.ts` |
| **수정** | `src/lib/reviewStats.ts` |
| **수정** | `src/components/reviews/PublicReviewCard.tsx` |
| **수정** | `src/app/reviews/[id]/page.tsx` |
| **수정** | `src/components/admin/SubHeader.tsx` |
| **수정** | `src/components/admin/sidebarConfig.tsx` |
| **수정** | `src/components/admin/AdminLayout.tsx` |
| **수정** | `src/components/admin/Breadcrumb.tsx` |

---

## 3. 신고 API 구현

**엔드포인트:** `POST /api/reviews/[id]/report`

- **Request body:** `{ reason: string }` (필수)
- **인증:** 로그인 필수 (`requireMemberSession`). 미로그인 시 401.
- **동작:**
  1. 리뷰 존재 및 `status === "submitted"` 확인
  2. `review_reports`에서 동일 `(review_id, member_id)` 존재 여부 조회
  3. 이미 있으면 409 + `{ message: "이미 해당 후기를 신고하셨습니다.", success: false }`
  4. 없으면 `review_reports`에 insert (status: 'pending')
  5. 성공 시 `{ success: true }` 반환

---

## 4. 신고 모달 UI

- **컴포넌트:** `src/components/reviews/ReviewReportModal.tsx` (클라이언트)
- **사유 선택지:** 광고/홍보, 욕설/비방, 허위 정보, 기타
- **기타 선택 시:** 텍스트 입력 필드 필수
- **확인 클릭:** `POST /api/reviews/{id}/report` 호출, body `{ reason }` (선택 라벨 또는 "기타: 입력값")
- **성공 시:** 모달 닫기, "신고가 접수되었습니다." 알림
- **노출 위치:** 리뷰 카드 ⋯ 메뉴의 "신고하기", 리뷰 상세 페이지의 "신고하기" 버튼

---

## 5. 관리자 신고 관리 페이지

- **경로:** `/admin/review-reports`, `/theall_manager_only/review-reports` (사이드바 "후기 신고")
- **페이지:** `src/app/admin/review-reports/page.tsx` (서버) + `AdminReviewReportsTable` (클라이언트)
- **표시 컬럼:** 리뷰 ID(링크), 리뷰 제목, 신고자(member_id), 사유, 신고일, 상태(대기/처리완료/무시), 리뷰 숨김 여부
- **액션:**
  - **리뷰 숨김:** `POST /api/admin/reviews/[id]/hide` body `{ action: "hide" }` → 해당 리뷰 `status = 'hidden'`
  - **복구:** `POST /api/admin/reviews/[id]/hide` body `{ action: "restore" }` → `status = 'submitted'`
  - **신고 무시:** `PATCH /api/admin/review-reports/[id]` body `{ status: "dismissed" }`
- **네비게이션:** 후기 관리 서브 탭에 "후기 목록" / "신고 목록" 추가, "신고 목록" 선택 시 해당 페이지로 이동

---

## 6. 리뷰 숨김 기능

- **API:** `POST /api/admin/reviews/[id]/hide`
- **Request body:** `{ action: "hide" | "restore" }`
- **인증:** 관리자 전용 (`requireAdminSession`)
- **동작:**
  - `action === "hide"` → `UPDATE reviews SET status = 'hidden', updated_at = now() WHERE id = ?`
  - `action === "restore"` → `UPDATE reviews SET status = 'submitted', updated_at = now() WHERE id = ?`
- **응답:** `{ message, status }` (status: 'hidden' 또는 'submitted')

---

## 7. 공개 리뷰 차단 방식

- **기존 로직 유지:** `src/lib/reviewStats.ts`의 모든 공개 조회는 `status = 'submitted'` 조건 사용.
- **영향 범위:**
  - `getPublicReviews` / `getProductReviews` / `getPublicReviewById` → `reviews.status = 'submitted'`만 조회
  - 따라서 `status = 'hidden'`인 리뷰는 **상품 상세, 리뷰 목록, 리뷰 상세** 모두에서 자동 제외됨.
- **추가 작업 없음:** hidden 전환만 하면 모든 공개 노출에서 제거됨.

---

## 8. 테스트 시나리오

1. **리뷰 신고**
   - 로그인 후 리뷰 목록 또는 상세에서 ⋯ → 신고하기(또는 상세 페이지 "신고하기") 클릭
   - 모달에서 사유 선택(기타 시 입력) 후 확인
   - DB `review_reports`에 1건 생성 확인, 성공 메시지 확인

2. **중복 신고 차단**
   - 같은 회원이 동일 리뷰에 대해 다시 신고 시도
   - 409 응답 및 "이미 해당 후기를 신고하셨습니다." 메시지 확인
   - 카드/상세에서 이미 신고한 경우 "신고됨" 표시 확인

3. **관리자 신고 목록**
   - 관리자 로그인 후 사이드바 "후기 신고" 또는 후기 관리 탭 "신고 목록" 이동
   - `/theall_manager_only/review-reports` (또는 `/admin/review-reports`)에서 신고 목록 표시 확인
   - 리뷰 ID, 신고자, 사유, 신고일, 상태 컬럼 확인

4. **리뷰 숨김**
   - 신고 목록에서 "리뷰 숨김" 클릭 후 확인
   - 해당 리뷰가 공개 목록/상품 상세/리뷰 상세에서 보이지 않음 확인
   - 관리자 테이블에서 해당 리뷰 행에 "숨김" 표시 확인

5. **복구**
   - 신고 목록에서 숨김 처리된 리뷰에 대해 "복구" 클릭
   - 해당 리뷰가 다시 공개 목록/상세에 노출되는지 확인

6. **신고 무시**
   - 상태가 "대기"인 신고에서 "신고 무시" 클릭
   - 해당 행 상태가 "무시"로 변경되는지 확인 (리뷰는 그대로 공개 유지)

---

## 참고

- **타입 확장:** `PublicReviewItem`에 `reportCount?`, `viewerReported?` 추가. 목록/상세 조회 시 `viewerMemberId`가 있으면 `viewerReported` 설정.
- **리뷰 카드:** `PublicReviewCard`에 ⋯ 메뉴 및 `ReviewCardReportButton` 추가. 클릭 시 전파 중단하여 링크 이동 없이 모달만 오픈.
- **리뷰 상세:** 헤더 영역에 `ReviewDetailReportButton` 추가. 이미 신고한 경우 "신고됨" 텍스트만 표시.
