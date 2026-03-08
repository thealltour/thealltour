# PR8: 리뷰 신뢰도 시스템 구축 — 결과 정리

## 1. Migration SQL

**파일:** `supabase/migrations/20260308200000_review_votes.sql`

```sql
-- PR8: 리뷰 도움됨(Helpful) 투표용 테이블
-- 한 사용자당 리뷰당 1회 투표 가능 (toggle)

CREATE TABLE IF NOT EXISTS public.review_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  member_id text NOT NULL,
  vote_type text NOT NULL DEFAULT 'helpful',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(review_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_review_votes_review_id
ON public.review_votes (review_id);

CREATE INDEX IF NOT EXISTS idx_review_votes_member_id
ON public.review_votes (member_id);

COMMENT ON TABLE public.review_votes IS '리뷰 도움됨(helpful) 투표. (review_id, member_id) 당 1건.';
```

- **테이블:** `review_votes`
- **필드:** `id`(uuid PK), `review_id`(uuid, FK → reviews), `member_id`(text), `vote_type`(text, 기본값 'helpful'), `created_at`(timestamptz)
- **제약:** `UNIQUE(review_id, member_id)` — 리뷰당 회원당 1건만 허용

---

## 2. 수정 파일 목록

| 구분 | 경로 |
|------|------|
| **신규** | `supabase/migrations/20260308200000_review_votes.sql` |
| **신규** | `src/app/api/reviews/[id]/vote/route.ts` |
| **신규** | `src/components/reviews/ReviewHelpfulButton.tsx` |
| **수정** | `src/types/review.ts` |
| **수정** | `src/lib/reviewStats.ts` |
| **수정** | `src/components/reviews/ReviewListFilters.tsx` |
| **수정** | `src/components/reviews/PublicReviewCard.tsx` |
| **수정** | `src/components/products/ProductReviewsSection.tsx` |
| **수정** | `src/app/reviews/page.tsx` |
| **수정** | `src/app/reviews/[id]/page.tsx` |

---

## 3. API 구현 내용

**엔드포인트:** `POST /api/reviews/[id]/vote`

- **Request body:** `{ voteType: "helpful" }`
- **인증:** 로그인 필수 (`requireMemberSession`). 미로그인 시 401.
- **동작 요약:**
  1. `review_id`로 리뷰 조회, `status === "submitted"` 확인
  2. `review_votes`에서 `(review_id, member_id, vote_type='helpful')` 존재 여부 조회
  3. **있으면:** 해당 행 삭제(toggle 해제) 후 현재 helpful 개수 조회
  4. **없으면:** insert 후 현재 helpful 개수 조회
- **Response:** `{ helpfulCount: number, voted: boolean }`
  - `voted`: 요청 후 현재 사용자가 해당 리뷰에 도움됨을 눌렀는지 여부

---

## 4. Helpful 투표 로직

- **한 사용자당 리뷰당 1회:** DB `UNIQUE(review_id, member_id)`로 보장
- **토글:** 이미 투표한 경우 같은 요청으로 삭제 → 취소
- **대상:** `status === "submitted"`인 공개 리뷰만 투표 가능
- **집계:** `review_votes`에서 `vote_type = 'helpful'`인 행 수를 `helpfulCount`로 사용
- **뷰어 투표 여부:** 목록/상세 조회 시 `viewerMemberId`를 넘기면 `viewerVotedHelpful`로 반환

---

## 5. 추천순 정렬 구현

- **정렬 옵션:** `ReviewSortOption`에 `"recommended"` 추가
- **정렬 기준:**  
  `helpfulCount DESC` → `rating DESC` → `created_at DESC`
- **구현 위치:** `src/lib/reviewStats.ts`의 `getPublicReviews`
  - `sort === "recommended"`일 때는 먼저 최대 500건까지 `created_at` 기준으로 조회
  - `review_votes` 집계로 각 리뷰의 `helpfulCount` 계산 후 메모리에서 위 기준으로 정렬
  - 마지막에 `offset`/`limit` 적용해 반환
- **UI:** `ReviewListFilters` 정렬 셀렉트에 "추천순" 옵션 추가

---

## 6. 베스트 후기 표시

- **위치:** 상품 상세 페이지 `ProductReviewsSection`
- **조건:** `rating >= 4` 이면서 **추천순 정렬 기준** 상위 1개
- **구현:**
  - 해당 상품 리뷰를 `sort: "recommended"`, `limit: 10`으로 조회
  - 그중 `rating >= 4`인 첫 번째 리뷰를 베스트 후기로 선택
  - 해당 카드 상단에 "BEST REVIEW" 뱃지(amber 배경) 표시
  - 베스트 1개 + 나머지 최대 4개로 총 최대 5개 카드 노출
- **도움됨 버튼:** 상품 상세 리뷰 카드와 리뷰 상세 페이지에 `ReviewHelpfulButton` 노출 (기존 목록 카드와 동일)

---

## 7. 테스트 시나리오

1. **도움됨 클릭 → count 증가**
   - 로그인 후 리뷰 목록/상세/상품 상세에서 "👍 도움됨" 클릭
   - 응답 `voted: true`, `helpfulCount` 1 증가 확인
   - 버튼이 선택 상태(파란 배경)로 바뀌는지 확인

2. **다시 클릭 → 취소**
   - 같은 리뷰에서 "도움됨" 한 번 더 클릭
   - 응답 `voted: false`, `helpfulCount` 1 감소 확인
   - 버튼이 비선택 상태로 돌아오는지 확인

3. **추천순 정렬**
   - `/reviews`에서 정렬을 "추천순"으로 선택
   - 도움됨이 많은 리뷰가 먼저 오고, 동일 시 평점·최신순으로 이어지는지 확인

4. **상품 상세 베스트 후기**
   - 해당 상품에 평점 4 이상 리뷰가 있고 도움됨 투표가 있는 경우
   - 추천순 1위이면서 평점 4 이상인 리뷰 카드에 "BEST REVIEW" 뱃지가 붙는지 확인

5. **미로그인**
   - 비로그인 상태에서 도움됨 클릭 시 로그인 페이지로 리다이렉트되는지 확인

---

## 참고

- 리뷰 목록/상세 조회 시 `viewerMemberId`를 넘기면 해당 회원의 도움됨 투표 여부(`viewerVotedHelpful`)가 채워짐.
- 리뷰 상세 페이지(`/reviews/[id]`)와 상품 상세 리뷰 섹션에도 동일한 도움됨 버튼이 노출됨.
