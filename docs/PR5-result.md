# PR5: 후기 작성 UX 고도화 + Draft/임시저장 + 이미지 업로드 강화

## 1. 수정 파일 목록

### 새 파일
- `supabase/migrations/20260307130000_reviews_draft_fields.sql`
- `src/app/api/reviews/[id]/route.ts`

### 수정 파일
- `src/types/review.ts`
- `src/lib/reviews.ts`
- `src/app/api/reviews/route.ts`
- `src/components/ReviewWriteForm.tsx`
- `src/app/reviews/write/page.tsx`
- `src/app/mypage/reviews/[id]/page.tsx`

---

## 2. Migration SQL 전문

### `20260307130000_reviews_draft_fields.sql`

```sql
-- reviews 테이블에 draft/여행 후기형 필드 추가
-- PR5: 후기 작성 UX 고도화 + Draft/임시저장 + 이미지 업로드 강화

-- ============================================
-- 1. 새 컬럼 추가
-- ============================================

-- updated_at 컬럼 (수정 시간)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- summary 컬럼 (한줄 요약)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS summary text;

-- content_good 컬럼 (좋았던 점)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS content_good text;

-- content_bad 컬럼 (아쉬웠던 점)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS content_bad text;

-- content_tip 컬럼 (여행 팁)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS content_tip text;

-- rating_schedule 컬럼 (일정 만족도)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS rating_schedule integer;

-- rating_stay 컬럼 (숙소 만족도)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS rating_stay integer;

-- rating_guide 컬럼 (가이드 만족도)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS rating_guide integer;

-- rating_food 컬럼 (식사 만족도)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS rating_food integer;

-- ============================================
-- 2. 인덱스 추가
-- ============================================

-- updated_at 인덱스 (최근 수정 순 정렬용)
CREATE INDEX IF NOT EXISTS idx_reviews_updated_at
ON public.reviews (updated_at DESC);

-- member_id + status 복합 인덱스 (마이페이지 조회용)
CREATE INDEX IF NOT EXISTS idx_reviews_member_status
ON public.reviews (member_id, status);
```

---

## 3. 후기 작성 페이지 UX 변경 내용

### 상단 상품/여행 정보 카드
- eligibility 기반 진입 시 상품명, 여행 일정, 안내 문구 표시
- 파란색 그라데이션 배경의 카드 스타일
- "이 여행은 어떠셨나요?" 안내 문구

### 입력 구조 개편

**기본 정보 섹션:**
- 제목 (title)
- 한줄 요약 (summary)
- 전체 만족도 (rating) - 필수(eligibility 기반)

**세부 평점 섹션 (eligibility 기반만):**
- 일정 만족도 (rating_schedule)
- 숙소 만족도 (rating_stay)
- 가이드 만족도 (rating_guide)
- 식사 만족도 (rating_food)

**후기 내용 섹션:**
- 좋았던 점 (content_good)
- 아쉬웠던 점 (content_bad)
- 여행 팁 (content_tip)
- 자유 형식 작성 (content) - 접이식 UI

### Validation 강화

**eligibility 기반 제출 시:**
- 제목 또는 한줄 요약 중 하나 필수
- 전체 만족도 필수
- content_good / content_bad / content_tip / content 중 하나 이상 필수

**자유 작성:**
- 제목, 내용 필수 (기존 하위호환 유지)

### 작성 가이드 UX
- 각 필드별 placeholder 개선
  - 좋았던 점: "일정, 숙소, 가이드, 식사 등 만족스러웠던 점을 적어주세요."
  - 아쉬웠던 점: "개선되면 좋을 점이 있었다면 적어주세요."
  - 여행 팁: "다른 여행자에게 도움이 될 팁을 남겨주세요."

---

## 4. Draft 저장/불러오기 방식

### 저장 방식
- **수동 임시저장 버튼** 제공
- 임시저장 시 `status: 'draft'`로 저장
- 동일 eligibility에 대해 **같은 review 레코드가 draft → submitted로 전환**되는 구조

### API 처리

**POST /api/reviews:**
- `status: 'draft'` 허용
- eligibility 기반 draft 저장 가능
- 기존 draft가 있으면 업데이트, 없으면 생성

**PATCH /api/reviews/[id]:**
- `action: 'save_draft'` - draft 저장
- `action: 'submit'` - 최종 제출
- submitted 상태 리뷰는 수정 불가

### 폼 동작
- [임시저장] 버튼으로 draft 저장
- 저장 성공 시 "임시저장되었습니다." 토스트 표시
- draft가 있는 eligibility로 진입 시 자동 로드

### 마이페이지 반영
- "작성 중인 후기" 섹션에 draft 표시
- 제목 없으면 "제목 없는 임시저장 후기"
- [이어쓰기] 버튼으로 draft 로드

---

## 5. 이미지 업로드 UX 변경 내용

### 최대 업로드 장수
- 기존 4장 → **10장**으로 확대

### 썸네일 미리보기
- 5열 grid 레이아웃 (모바일 3열)
- 첫 이미지에 "대표" 배지 표시

### 개별 삭제 지원
- 각 이미지에 X 버튼으로 개별 삭제 가능
- hover 시 삭제 버튼 표시

### 파일 선택 UX
- "+ 사진 추가" 버튼
- 선택 개수/최대 개수 표시: "N장 선택됨 (최대 10장)"

### 업로드 전 검증
- 파일 형식: PNG, JPEG, WebP, GIF
- 파일 크기: 최대 5MB
- 최대 개수: 10장

### TODO (향후 개선)
```typescript
// TODO: drag & drop, 이미지 순서 변경, webp 변환, EXIF 회전 처리
```

---

## 6. Eligibility 기반 제출 흐름

### 진입 UX
1. `/reviews/write?eligibility=<id>` 진입
2. 기존 draft가 있으면 자동 로드
3. 상품 정보 카드 표시

### 이미 submitted 된 eligibility
- 폼 렌더링 차단
- "이미 작성 완료된 후기입니다." 메시지
- "내 후기 보기 →" 링크 제공

### Claim 완료 후 흐름
```
/reviews/claim/<token>
  → /mypage/reviews
  → [후기 작성] 버튼
  → /reviews/write?eligibility=<id>
```

---

## 7. 상세/목록 하위호환 처리

### 리뷰 상세 페이지 (`/mypage/reviews/[id]`)

**새 구조 리뷰:**
- summary 있으면 제목 아래 요약 표시
- 세부 평점 grid 표시 (있는 경우)
- content_good / content_bad / content_tip 섹션형 표시

**기존 구조 리뷰:**
- content만 있으면 기존 방식으로 표시
- 제목, 평점, 이미지 정상 표시

### Content 하위호환 정책
- 제출 시 `content` 필드에 fallback 텍스트 생성:
  ```
  [좋았던 점]
  {content_good}

  [아쉬웠던 점]
  {content_bad}

  [여행 팁]
  {content_tip}
  ```
- 상세 페이지에서 자동 생성된 content인지 판별하여 중복 표시 방지

---

## 8. 테스트 시나리오

### 1) eligibility 기반 draft 저장
- [ ] `/reviews/write?eligibility=<id>` 진입
- [ ] 일부 내용 작성 후 [임시저장] 클릭
- [ ] "임시저장되었습니다." 메시지 확인
- [ ] 마이페이지 "작성 중인 후기" 섹션 표시 확인

### 2) draft 이어쓰기
- [ ] 마이페이지에서 [이어쓰기] 클릭
- [ ] 기존 입력값 자동 로드 확인

### 3) draft 제출
- [ ] draft 상태에서 [후기 등록] 클릭
- [ ] status: draft → submitted 변경 확인
- [ ] writable에서 사라지고 submitted로 이동 확인

### 4) 자유 작성 하위호환
- [ ] `/reviews/write` 직접 접속
- [ ] 기존 title/content/rating 구조로 제출 가능 확인

### 5) 이미지 업로드
- [ ] 여러 장 선택 (최대 10장)
- [ ] 썸네일 grid 표시 확인
- [ ] 개별 삭제 (X 버튼) 동작 확인
- [ ] 첫 이미지 "대표" 배지 표시 확인
- [ ] 최종 제출 시 image_urls 저장 확인

### 6) validation
- [ ] eligibility 작성에서 rating 없이 제출 → 에러
- [ ] 본문 계열 입력 없이 제출 → 에러
- [ ] 5MB 초과 이미지 선택 → 에러
- [ ] 10장 초과 이미지 선택 → 에러

### 7) 상세 페이지 하위호환
- [ ] 기존 리뷰 (content만) 상세 페이지 정상 표시
- [ ] 신규 구조 리뷰 상세 페이지 정상 표시

---

## 9. 남은 TODO

### 이미지 처리 고도화
- [ ] Drag & drop 업로드
- [ ] 이미지 순서 변경 (sort_order)
- [ ] 클라이언트 이미지 압축/webp 변환
- [ ] EXIF 회전 처리

### UX 개선
- [ ] 자동 임시저장 (debounce 기반)
- [ ] 작성 중 페이지 이탈 방지 (beforeunload)
- [ ] 이미지 업로드 진행률 표시

### 관리자 기능
- [ ] 관리자 후기 숨김/삭제 기능
- [ ] hidden 상태 리뷰 관리

---

## 타입 정의

### Review 타입 (확장)

```typescript
export type Review = {
  id: string;
  member_id?: string;
  title: string;
  content: string;
  image_url?: string;
  image_urls?: string[];
  author_name: string;
  created_at?: string;
  updated_at?: string;
  rating?: number;
  status?: ReviewStatus;
  eligibility_id?: string;
  booking_id?: string;
  customer_profile_id?: string;

  // PR5 확장 필드
  summary?: string;
  content_good?: string;
  content_bad?: string;
  content_tip?: string;
  rating_schedule?: number;
  rating_stay?: number;
  rating_guide?: number;
  rating_food?: number;
};
```

---

## API 변경 사항

### POST /api/reviews

**추가 필드:**
```json
{
  "status": "draft" | "submitted",
  "summary": "string",
  "content_good": "string",
  "content_bad": "string",
  "content_tip": "string",
  "rating_schedule": 1-5,
  "rating_stay": 1-5,
  "rating_guide": 1-5,
  "rating_food": 1-5
}
```

### PATCH /api/reviews/[id] (신규)

**Request:**
```json
{
  "action": "save_draft" | "submit",
  "title": "string",
  "content": "string",
  "summary": "string",
  "content_good": "string",
  "content_bad": "string",
  "content_tip": "string",
  "image_urls": ["string"],
  "rating": 1-5,
  "rating_schedule": 1-5,
  "rating_stay": 1-5,
  "rating_guide": 1-5,
  "rating_food": 1-5
}
```

**Response:**
```json
{
  "message": "임시저장되었습니다." | "후기가 등록되었습니다.",
  "review_id": "uuid"
}
```

---

## 기존 기능 유지 확인

- [x] PR3 eligibility 기반 진입 흐름 유지
- [x] PR3 마이페이지 3섹션 구조 유지
- [x] PR4 claim token 플로우 유지
- [x] 자유 작성 하위호환 유지
- [x] 기존 리뷰 상세 페이지 정상 동작
