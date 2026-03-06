# PR3 보완: eligibility 기반 후기 제출 완료 처리 연결 — 결과 정리

## 1. 수정 파일 목록

| 구분 | 파일 |
|------|------|
| **추가** | `supabase/migrations/20260307100000_reviews_eligibility_columns.sql` |
| **수정** | `src/app/api/reviews/route.ts` |
| **수정** | `src/lib/reviewEligibilities.ts` |
| **수정** | `src/lib/reviews.ts` |
| **수정** | `src/components/ReviewWriteForm.tsx` |
| **추가** | `docs/PR3-supplement-result.md` (본 문서) |

---

## 2. 실제 추가된 migration 여부와 SQL

**파일:** `supabase/migrations/20260307100000_reviews_eligibility_columns.sql`

### 전체 SQL

```sql
-- reviews 테이블에 eligibility 기반 후기 제출을 위한 컬럼 추가
-- PR3 보완: eligibility 기반 후기 제출 완료 처리 연결

-- ============================================
-- 1. 컬럼 추가 (ADD COLUMN IF NOT EXISTS 사용)
-- ============================================

-- rating 컬럼 (별점)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS rating integer;

-- image_url 컬럼 (단일 이미지, 레거시)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS image_url text;

-- image_urls 컬럼 (복수 이미지)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

-- eligibility_id 컬럼 (후기 작성 자격 연결)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS eligibility_id uuid;

-- booking_id 컬럼 (여행 예약 연결)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS booking_id uuid;

-- customer_profile_id 컬럼 (고객 프로필 연결)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS customer_profile_id uuid;

-- status 컬럼 (draft, submitted, hidden)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted';

-- ============================================
-- 2. FK 제약조건 추가 (이미 있으면 스킵)
-- ============================================

DO $$
BEGIN
  -- eligibility_id FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reviews_eligibility_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'reviews'
  ) THEN
    ALTER TABLE public.reviews
    ADD CONSTRAINT reviews_eligibility_id_fkey
    FOREIGN KEY (eligibility_id) REFERENCES public.review_eligibilities(id) ON DELETE SET NULL;
  END IF;

  -- booking_id FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reviews_booking_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'reviews'
  ) THEN
    ALTER TABLE public.reviews
    ADD CONSTRAINT reviews_booking_id_fkey
    FOREIGN KEY (booking_id) REFERENCES public.travel_bookings(id) ON DELETE SET NULL;
  END IF;

  -- customer_profile_id FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reviews_customer_profile_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'reviews'
  ) THEN
    ALTER TABLE public.reviews
    ADD CONSTRAINT reviews_customer_profile_id_fkey
    FOREIGN KEY (customer_profile_id) REFERENCES public.customer_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- 3. 인덱스 생성
-- ============================================

-- 하나의 eligibility당 후기 1개만 허용하는 unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_eligibility_unique
ON public.reviews (eligibility_id)
WHERE eligibility_id IS NOT NULL;

-- eligibility_id로 빠른 조회
CREATE INDEX IF NOT EXISTS idx_reviews_eligibility_id
ON public.reviews (eligibility_id)
WHERE eligibility_id IS NOT NULL;

-- status로 필터링
CREATE INDEX IF NOT EXISTS idx_reviews_status
ON public.reviews (status);
```

### 핵심 포인트

- `ADD COLUMN IF NOT EXISTS`로 idempotent하게 동작
- FK 제약조건은 DO $$ 블록에서 존재 여부 확인 후 추가
- `eligibility_id`에 unique partial index로 1 eligibility : 1 review 보장
- 기존 자유 작성 리뷰는 `eligibility_id = NULL`이므로 영향 없음
- `status` 컬럼 default가 `'submitted'`이므로 기존 데이터 하위호환

---

## 3. /api/reviews eligibility 처리 방식

### 요청 body 확장

```typescript
type ReviewBody = {
  title?: string;
  content?: string;
  image_url?: string | null;
  image_urls?: string[];
  rating?: number;
  eligibility_id?: string;  // 추가
};
```

### eligibility_id가 있을 때 서버 동작

1. **eligibility 존재 확인:** `getEligibilityById(eligibilityId)`
2. **권한 확인:** `eligibility.claimed_by_member_id === session.memberId`
3. **상태 확인:** `eligibility.status in ('eligible', 'claimed')`
4. **중복 확인:** `getReviewByEligibilityId(eligibilityId)` → 이미 있으면 409
5. **insert payload에 추가:**
   - `eligibility_id`
   - `booking_id` (eligibility에서 가져옴)
   - `customer_profile_id` (eligibility에서 가져옴)
   - `status: 'submitted'`
6. **insert 성공 후:** `updateEligibilityStatus(eligibilityId, 'submitted')`

### eligibility_id가 없을 때

- 기존 자유 작성 흐름 그대로 유지 (하위호환)

---

## 4. 중복 제출 방지 로직

### 1차 방어: 코드 레벨

```typescript
const existingReview = await getReviewByEligibilityId(eligibilityId);
if (existingReview) {
  return NextResponse.json({ message: "이미 후기를 작성한 여행건입니다." }, { status: 409 });
}
```

### 2차 방어: DB 레벨

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_eligibility_unique
ON public.reviews (eligibility_id)
WHERE eligibility_id IS NOT NULL;
```

- DB unique index로 동시 요청에서도 중복 insert 방지
- unique violation 발생 시 409 반환

### 3차 방어: eligibility 상태 확인

```typescript
if (!["eligible", "claimed"].includes(eligibility.status)) {
  if (eligibility.status === "submitted") {
    return NextResponse.json({ message: "이미 후기를 작성한 여행건입니다." }, { status: 409 });
  }
  // ...
}
```

---

## 5. review_eligibilities 상태 업데이트 방식

### 추가된 함수 (`reviewEligibilities.ts`)

```typescript
export async function updateEligibilityStatus(
  eligibilityId: string,
  status: ReviewEligibilityStatus,
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("review_eligibilities")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eligibilityId);

  return !error;
}
```

### 호출 시점

```typescript
// /api/reviews POST에서 insert 성공 후
if (eligibilityId) {
  await updateEligibilityStatus(eligibilityId, "submitted");
}
```

### 상태 전이

| 이전 상태 | 후기 제출 후 |
|-----------|-------------|
| `eligible` | `submitted` |
| `claimed` | `submitted` |

---

## 6. 마이페이지 writable → submitted 반영 방식

### writable 섹션에서 제외되는 조건

1. **eligibility 상태 필터:** `getWritableEligibilitiesByMemberId`가 `status in ('eligible', 'claimed')`만 조회
   - 후기 제출 후 `status = 'submitted'`가 되면 자동으로 제외

2. **이중 확인:** `getReviewByEligibilityId`로 해당 eligibility로 작성된 리뷰 존재 여부 확인
   - 있으면 writable에서 제외

### submitted 섹션에 표시되는 조건

- `getSubmittedReviewsByMemberId`가 `status = 'submitted'`인 리뷰 조회
- `member_id = 현재 사용자` 기준

### 흐름 요약

```
[작성 가능한 후기 클릭]
    ↓
/reviews/write?eligibility=<id>
    ↓
[후기 작성 및 제출]
    ↓
POST /api/reviews (eligibility_id 포함)
    ↓
1. reviews INSERT (eligibility_id, booking_id, customer_profile_id, status='submitted')
2. review_eligibilities UPDATE (status='submitted')
    ↓
[/mypage/reviews로 이동]
    ↓
getMyPageReviewSections 재조회
    ↓
- writable: eligibility.status='submitted'이므로 제외
- submitted: 방금 작성한 리뷰 표시
```

---

## 7. 테스트 시나리오

### 시나리오 1: eligibility 기반 후기 작성 전체 흐름

1. 관리자에서 문의 → 예약 확정 → 여행 완료 처리 (PR2 플로우)
2. review_eligibility 생성됨, `claimed_by_member_id`를 테스트 회원으로 설정
3. 마이페이지 `/mypage/reviews` 접속
4. "작성 가능한 후기" 섹션에 항목 표시 확인
5. [후기 작성] 클릭 → `/reviews/write?eligibility=<id>`로 이동
6. 제목, 내용, 별점 입력 후 제출
7. `/mypage/reviews`로 자동 이동 확인
8. "작성 가능한 후기"에서 해당 항목 사라짐 확인
9. "작성 완료 후기"에 방금 작성한 후기 표시 확인

### 시나리오 2: 중복 제출 방지

1. 이미 후기를 작성한 eligibility ID로 `/reviews/write?eligibility=<id>` 접속
2. "이미 후기를 작성한 여행건입니다." 메시지 표시 확인
3. 또는 직접 POST 요청 시 409 응답 확인

### 시나리오 3: 권한 없는 eligibility 접근

1. 다른 회원에게 claim된 eligibility ID로 접속
2. "본인에게 부여된 후기 작성 권한이 아닙니다." 403 응답 확인

### 시나리오 4: 만료/차단된 eligibility

1. `status = 'expired'`인 eligibility로 접속
2. "후기 작성 기한이 만료되었습니다." 400 응답 확인

### 시나리오 5: 자유 작성 리뷰 하위호환

1. `/reviews/write` 직접 접속 (eligibility 없이)
2. 후기 작성 및 제출
3. `/reviews` 목록으로 이동 확인
4. 기존 자유 작성 흐름 정상 동작 확인

### 시나리오 6: DB unique index 테스트

1. 동일 eligibility_id로 동시에 2개 insert 시도 (테스트 코드 또는 직접 SQL)
2. 하나만 성공, 나머지는 unique violation 확인

---

## 8. 남은 TODO

### 임시저장(draft) 기능

- 현재 status 컬럼은 추가되었으나, draft 저장 로직은 미구현
- ReviewWriteForm에 임시저장 버튼 추가 필요
- POST /api/reviews에 `status: 'draft'` 처리 추가 필요

### /reviews/write에서 상품 정보 표시

- eligibility 기반 진입 시 상품명, 여행일정 표시하면 UX 개선
- `getEligibilityWithBookingById` 활용 가능

### claim 토큰 플로우

- 현재는 `claimed_by_member_id`를 직접 설정해야 함
- 후속 PR4에서 claim 토큰 기반 연결 구현 예정

### reviews 목록에서 eligibility 기반 리뷰 구분 표시

- 공개 리뷰 목록에서 "인증된 여행 후기" 배지 등 표시 가능
- eligibility_id가 있는 리뷰 = 실제 여행 후 작성된 후기

### 성능 최적화

- `getMyPageReviewSections`에서 N+1 쿼리 발생 (eligibility마다 getReviewByEligibilityId 호출)
- 개선 방안: eligibility 조회 시 reviews left join으로 한 번에 처리
