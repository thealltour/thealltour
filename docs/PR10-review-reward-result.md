# PR10: 후기 작성 보상 시스템 구축 — 결과 정리

## 1. Migration SQL

**파일:** `supabase/migrations/20260308220000_review_rewards.sql`

```sql
-- PR10: 리뷰 보상 테이블 (인증 후기 작성 시 포인트 지급, 리뷰당 1회)
CREATE TABLE IF NOT EXISTS public.review_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  member_id text NOT NULL,
  reward_type text NOT NULL DEFAULT 'review_write',
  points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(review_id)
);

CREATE INDEX IF NOT EXISTS idx_review_rewards_review_id
ON public.review_rewards (review_id);

CREATE INDEX IF NOT EXISTS idx_review_rewards_member_id
ON public.review_rewards (member_id);

COMMENT ON TABLE public.review_rewards IS '리뷰 작성 보상. review_id당 1회 지급. reward_type: review_write 등';
```

- **테이블:** `review_rewards`
- **필드:** `id`(uuid PK), `review_id`(uuid FK → reviews, UNIQUE), `member_id`(text), `reward_type`(text, 기본값 'review_write'), `points`(integer), `created_at`(timestamptz)
- **제약:** `UNIQUE(review_id)` — 리뷰당 1회만 지급

---

## 2. 수정 파일 목록

| 구분 | 경로 |
|------|------|
| **신규** | `supabase/migrations/20260308220000_review_rewards.sql` |
| **신규** | `src/lib/reviewRewards.ts` |
| **수정** | `src/app/api/reviews/route.ts` |
| **수정** | `src/app/api/reviews/[id]/route.ts` |
| **수정** | `src/components/ReviewWriteForm.tsx` |

---

## 3. Reward 지급 로직

- **기본 정책:** 인증 후기(eligibility 기반) 제출 시 **1,000 포인트** 지급.
- **조건:**
  - `reviews.status = 'submitted'`
  - `reviews.eligibility_id IS NOT NULL`
- **자유 작성 리뷰(eligibility 없음):** 보상 없음.
- **인증 후기만:** `createReviewReward(review)` 호출 시 위 조건을 만족할 때만 insert.

**연동 위치**

1. **POST /api/reviews**
   - 기존 draft → submitted 업데이트 후, `eligibilityId`가 있으면 `createReviewReward` 호출.
   - 신규 insert 후 `!isDraft && eligibilityId && insertResult.data`이면 `createReviewReward` 호출.
   - 응답에 `rewardCreated`, `pointsAwarded` 포함.
2. **PATCH /api/reviews/[id]**
   - `action === "submit"` 처리 후 `review.eligibility_id`가 있으면 `createReviewReward` 호출.
   - 응답에 `rewardCreated`, `pointsAwarded` 포함.

---

## 4. reviewRewards 서비스 함수

**파일:** `src/lib/reviewRewards.ts`

- **함수:** `createReviewReward(review, options?)`
- **인자:** `review`: `{ id, member_id?, status?, eligibility_id? }`, `options.points`(선택, 기본 1,000)
- **동작:**
  1. `status !== 'submitted'` 또는 `!eligibility_id` 또는 `!member_id` → `{ rewardCreated: false, points: 0 }` 반환.
  2. `review_rewards`에서 `review_id`로 기존 행 조회.
  3. 있으면 → `{ rewardCreated: false, points: 기존 points }` 반환.
  4. 없으면 → `review_rewards`에 insert (`reward_type: 'review_write'`, `points`) 후 `{ rewardCreated: true, points }` 반환.
- **상수:** `REWARD_TYPE_REVIEW_WRITE = 'review_write'`, `DEFAULT_REVIEW_WRITE_POINTS = 1000`.
- **확장:** `options.points`로 지급 포인트 변경 가능. 향후 `reward_type`(예: review_best, review_event) 및 config/관리자 설정 연동 가능.

---

## 5. UX 개선 내용

**파일:** `src/components/ReviewWriteForm.tsx`

- **변경 전:** 제출 성공 시 곧바로 `router.push("/mypage/reviews")` 또는 `router.push("/reviews")`.
- **변경 후:** 제출 성공 시 **모달** 표시.
  - **제목:** 🎉 후기 등록 완료
  - **문구:** 여행 경험을 공유해주셔서 감사합니다.
  - **포인트:** 인증 후기로 지급된 경우에만 «N 포인트가 지급되었습니다» 표시 (예: 1,000 포인트).
  - **버튼:**
    - **작성한 후기 보기** → `/reviews/{reviewId}` 이동 후 모달 닫기.
    - **다른 후기 보기** → eligibility 기반이면 `/mypage/reviews`, 아니면 `/reviews` 이동 후 모달 닫기.
- **구현:** 상태 `submitSuccessModal: { reviewId, pointsAwarded? } | null` 추가. API 응답에 `review_id`가 있으면 모달 표시, `pointsAwarded`가 있으면 포인트 문구 표시.

---

## 6. 중복 지급 방지 방식

1. **DB 제약:** `review_rewards.review_id`에 `UNIQUE(review_id)` 적용 → 동일 리뷰로 두 건 이상 insert 불가.
2. **코드 방어:** `createReviewReward` 내부에서 insert 전에 `review_rewards`에서 해당 `review_id` 조회. 이미 있으면 insert 하지 않고 `rewardCreated: false` 반환.
3. **호출 시점:** 리뷰가 **최종 제출(submitted)** 될 때만 호출. draft 저장·수정 시에는 호출하지 않음.

---

## 7. 테스트 시나리오

1. **인증 후기 작성**
   - claim → write → submit 플로우 진행.
   - DB `review_rewards`에 해당 `review_id`로 1건 생성되는지 확인.
   - `reward_type = 'review_write'`, `points = 1000` 확인.

2. **포인트 지급**
   - 제출 성공 응답에 `rewardCreated: true`, `pointsAwarded: 1000` 포함되는지 확인.
   - 화면에 «후기 등록 완료» 모달과 «1,000 포인트가 지급되었습니다» 문구 표시 확인.

3. **중복 제출 방지**
   - 이미 제출된 리뷰는 수정 불가하므로, 동일 리뷰로 다시 제출되는 경로는 없음.
   - 만약 같은 리뷰에 대해 `createReviewReward`가 두 번 호출되면 두 번째는 기존 행으로 인해 insert 없이 `rewardCreated: false` 반환.

4. **자유 리뷰**
   - eligibility 없이 작성·제출한 리뷰는 `createReviewReward`가 호출되지 않거나, 호출되더라도 `eligibility_id` 없음으로 insert 되지 않음.
   - `review_rewards`에 해당 리뷰 행이 생기지 않음. 모달에는 포인트 문구 없이 «후기 등록 완료»만 표시.

5. **draft → submit**
   - 기존 draft를 제출할 때도 인증 후기이면 한 번만 보상 지급. PATCH 응답에 `rewardCreated`, `pointsAwarded` 포함 여부 확인.

---

## 참고

- **사용자 포인트 표시:** 현재는 `review_rewards`에만 기록. 추후 `member_points` 등 포인트 시스템과 연동 시 해당 테이블과 조인하거나 동기화하는 구조로 확장 가능.
- **관리자 정책:** `reward_type`(예: review_write, review_best, review_event), `points` 값은 설정/관리자 UI로 조정 가능하도록 `createReviewReward`의 `options` 및 정책 조회 로직 확장 가능.
