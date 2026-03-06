# PR4: 후기 Claim Token 시스템 + Eligibility 기반 후기 작성 UX 완성 — 결과 정리

## 1. 수정 파일 목록

| 구분 | 파일 |
|------|------|
| **추가** | `supabase/migrations/20260307120000_review_claim_token.sql` |
| **수정** | `src/types/reviewEligibility.ts` |
| **수정** | `src/lib/reviewEligibilities.ts` |
| **수정** | `src/app/api/inquiries/[id]/route.ts` |
| **추가** | `src/app/api/reviews/claim/route.ts` |
| **추가** | `src/app/reviews/claim/[token]/page.tsx` |
| **수정** | `src/app/reviews/write/page.tsx` |
| **추가** | `docs/PR4-result.md` (본 문서) |

---

## 2. migration SQL 전문

**파일:** `supabase/migrations/20260307120000_review_claim_token.sql`

```sql
-- review_eligibilities에 Claim Token 컬럼 추가
-- PR4: 후기 Claim Token 시스템

-- ============================================
-- 1. Claim Token 컬럼 추가
-- ============================================

-- claim_token: 후기 권한 연결용 토큰 (uuid 형식)
ALTER TABLE public.review_eligibilities
ADD COLUMN IF NOT EXISTS claim_token text;

-- claim_token_expires_at: 토큰 만료시간 (여행 완료 후 90일 권장)
ALTER TABLE public.review_eligibilities
ADD COLUMN IF NOT EXISTS claim_token_expires_at timestamptz;

-- ============================================
-- 2. 인덱스 추가
-- ============================================

-- claim_token unique index (token 조회 + 중복 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_eligibilities_claim_token
ON public.review_eligibilities (claim_token)
WHERE claim_token IS NOT NULL;
```

---

## 3. claim_token 생성 로직

### 타입 확장 (`src/types/reviewEligibility.ts`)

```typescript
export type ReviewEligibility = {
  // ... 기존 필드 ...
  claim_token: string | null;
  claim_token_expires_at: string | null;
};

export type ReviewEligibilityInput = {
  // ... 기존 필드 ...
  claim_token?: string | null;
  claim_token_expires_at?: string | null;
};
```

### 헬퍼 함수 (`src/lib/reviewEligibilities.ts`)

```typescript
/** Claim Token 생성 (UUID v4 형식) */
export function generateClaimToken(): string {
  return crypto.randomUUID();
}

/** Claim Token 만료일 계산 (기본 90일) */
export function getClaimTokenExpiresAt(days = 90): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
```

### complete_trip 액션에서 자동 생성 (`src/app/api/inquiries/[id]/route.ts`)

```typescript
const eligibility = await createEligibilityIfNotExists(booking.id, customerProfileId, {
  withClaimToken: true,  // claim_token 자동 생성
});

// 응답에 claim_token과 claim_link 포함
return NextResponse.json({
  message: "여행 완료 및 후기 자격이 생성되었습니다.",
  claim_token: eligibility.claim_token,
  claim_link: eligibility.claim_token ? `/reviews/claim/${eligibility.claim_token}` : null,
});
```

---

## 4. Claim API 구현

**파일:** `src/app/api/reviews/claim/route.ts`

### 엔드포인트

```
POST /api/reviews/claim
```

### 요청 body

```json
{
  "claim_token": "<uuid>"
}
```

### 처리 흐름

1. **로그인 확인:** 세션 없으면 401
2. **토큰 조회:** `getEligibilityByClaimToken(claimToken)`
3. **검증:**
   - 토큰 존재 여부 (404)
   - 만료 여부 (410)
   - submitted 상태 여부 (409)
   - 이미 다른 회원이 claim 했는지 (409)
4. **claim 처리:**
   - `claimed_by_member_id = session.memberId`
   - `status = 'claimed'`
   - `claimed_at = now`
5. **응답:**
   ```json
   { "success": true, "eligibility_id": "<uuid>" }
   ```

### 에러 응답

| 상황 | HTTP 상태 | error 코드 |
|------|-----------|------------|
| 로그인 필요 | 401 | `unauthorized` |
| 토큰 없음 | 404 | `not_found` |
| 토큰 만료 | 410 | `expired` |
| 이미 제출됨 | 409 | `already_submitted` |
| 다른 회원 claim | 409 | `already_claimed_by_other` |

---

## 5. Claim landing page 동작

**파일:** `src/app/reviews/claim/[token]/page.tsx`

### URL

```
/reviews/claim/<claim_token>
```

### 동작 흐름

1. **페이지 로딩** → 로딩 스피너 표시
2. **Claim API 호출** → `POST /api/reviews/claim { claim_token }`
3. **결과 처리:**
   - **성공:** 2초 후 `/mypage/reviews`로 자동 이동
   - **로그인 필요:** 로그인/회원가입 버튼 표시 (redirect 파라미터 포함)
   - **에러:** 에러 유형별 안내 메시지 표시

### UI 상태

| 상태 | 표시 내용 |
|------|----------|
| loading | 로딩 스피너 + "권한 연결 중" |
| success | 체크 아이콘 + "연결 완료" + 마이페이지 이동 안내 |
| need_login | 사람 아이콘 + 로그인/회원가입 버튼 |
| error | X 아이콘 + 에러별 메시지 |

---

## 6. 마이페이지 연결 흐름

```
[관리자: 여행 완료 처리]
    ↓
claim_token 자동 생성 (90일 만료)
    ↓
[관리자 → 고객에게 링크 전달]
https://site.com/reviews/claim/<token>
    ↓
[고객: 링크 접속]
    ↓
[로그인 안 됨?] → 로그인 페이지 (redirect 포함)
    ↓
[로그인 후 자동 claim]
    ↓
eligibility.claimed_by_member_id = 고객 memberId
eligibility.status = 'claimed'
    ↓
[/mypage/reviews로 이동]
    ↓
[작성 가능한 후기 섹션에 표시]
    ↓
[후기 작성] → PR3 흐름 그대로
```

---

## 7. 보안 처리

### 토큰 안전성

- **UUID v4 사용:** `crypto.randomUUID()` (122비트 엔트로피)
- **Unique index:** 중복 토큰 방지
- **서버 생성:** 클라이언트에서 토큰 생성 불가

### 만료 처리

- **기본 90일:** `getClaimTokenExpiresAt(90)`
- **API에서 검증:** `claim_token_expires_at < now` → 410 응답

### Claim 검증

| 검증 항목 | 처리 |
|----------|------|
| 토큰 존재 | 404 반환 |
| 토큰 만료 | 410 반환 |
| 이미 submitted | 409 반환 |
| 다른 회원 claim | 409 반환 |
| 동일 회원 재claim | OK (멱등성) |

### RLS 정책

- `review_eligibilities`는 `supabaseAdmin` (service_role)으로만 접근
- 클라이언트에서 직접 eligibility 수정 불가

---

## 8. 테스트 시나리오

### 시나리오 1: 전체 플로우 (정상 케이스)

1. 관리자: 문의 → 예약 확정 → 여행 완료 처리
2. 응답에서 `claim_link` 확인
3. 고객: `/reviews/claim/<token>` 접속
4. 로그인 상태 → claim 성공 → `/mypage/reviews` 이동
5. "작성 가능한 후기" 섹션에 항목 표시 확인
6. [후기 작성] → 제출 → "작성 완료 후기"로 이동 확인

### 시나리오 2: 비로그인 상태 claim

1. 로그아웃 상태에서 `/reviews/claim/<token>` 접속
2. "로그인이 필요합니다" 안내 + 로그인/회원가입 버튼 확인
3. 로그인 클릭 → `/auth/signin?redirect=/reviews/claim/<token>`
4. 로그인 후 claim 페이지로 돌아옴 → 자동 claim → 마이페이지 이동

### 시나리오 3: 만료된 토큰

1. 90일 이상 지난 claim_token으로 접속
2. "후기 작성 링크가 만료되었습니다." 메시지 확인

### 시나리오 4: 이미 다른 계정 claim

1. A 계정으로 claim 완료
2. B 계정으로 동일 토큰 접속
3. "이미 다른 계정에서 연결된 후기 권한입니다." 메시지 확인

### 시나리오 5: 이미 제출된 후기

1. claim 후 후기 작성 완료 (eligibility.status = submitted)
2. 동일 토큰으로 재접속
3. "이미 후기가 작성된 여행건입니다." 메시지 확인

### 시나리오 6: 동일 계정 재claim (멱등성)

1. A 계정으로 claim 완료
2. A 계정으로 동일 토큰 재접속
3. 정상 성공 → 마이페이지 이동

### 시나리오 7: 후기 작성 페이지 상품 정보 표시

1. `/reviews/write?eligibility=<id>` 접속
2. 상품명, 여행 일정이 페이지 상단에 표시되는지 확인

---

## 9. 남은 TODO

### 관리자 UI에서 claim_link 표시

- 여행 완료 처리 후 claim_link를 관리자 화면에 표시
- 복사 버튼 추가하여 쉽게 고객에게 전달 가능하게

### 이메일/SMS 연동

- 여행 완료 시 고객에게 자동으로 claim 링크 발송
- 카카오 알림톡 연동 가능

### claim_token 재발급

- 만료된 경우 관리자가 재발급할 수 있는 기능
- 기존 토큰 무효화 후 새 토큰 생성

### 후기 작성 리마인더

- claim 후 일정 기간 내 후기 미작성 시 리마인더 발송
- review_deadline_at 활용

### 포인트/적립금 연동

- 후기 작성 완료 시 적립금 지급
- 관리자 승인 후 지급 or 자동 지급 정책 결정
