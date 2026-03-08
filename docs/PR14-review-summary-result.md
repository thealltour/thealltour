# PR14: 리뷰 AI 요약 시스템 결과

## 1. 수정/추가 파일 목록

### 신규
- `supabase/migrations/20260309110000_product_review_summaries.sql` — 요약 테이블
- `src/lib/reviewSummaries.ts` — 요약 CRUD·소스 리뷰 조회
- `src/lib/ai/reviewSummary.ts` — 요약 생성(rule-based, LLM 교체 가능 구조)
- `src/app/api/admin/products/[id]/review-summary/route.ts` — 재생성 API
- `src/app/api/admin/review-summaries/route.ts` — 관리자 요약 목록 API
- `src/app/theall_manager_only/review-summaries/page.tsx` — 관리자 리뷰 요약 페이지
- `src/components/products/ProductReviewSummaryCard.tsx` — 상품 상세 요약 카드

### 수정
- `src/lib/travelBookings.ts` — `getProductIdByBookingId(bookingId)` 추가
- `src/app/api/reviews/route.ts` — 리뷰 제출 시 해당 상품 요약 stale 처리
- `src/app/api/reviews/[id]/route.ts` — PATCH submit 시 해당 상품 요약 stale 처리
- `src/app/api/admin/reviews/[id]/hide/route.ts` — hide/restore 시 해당 상품 요약 stale 처리
- `src/components/products/ProductReviewsSection.tsx` — `ProductReviewSummaryCard` 노출
- `src/lib/seo/products.ts` — summary_text 활용 SEO TODO 추가
- 관리자 레이아웃/사이드바/SubHeader — "리뷰 요약" 메뉴 및 경로 추가

---

## 2. Migration SQL

**파일:** `supabase/migrations/20260309110000_product_review_summaries.sql`

- **테이블:** `product_review_summaries`
- **컬럼:**  
  `id`(uuid PK), `product_id`(text not null), `review_count`(integer default 0),  
  `average_rating`(numeric(3,2)), `summary_text`(text),  
  `positive_points`(jsonb), `negative_points`(jsonb), `recommended_for`(jsonb),  
  `generated_at`, `updated_at`(timestamptz), `source_review_ids`(jsonb),  
  `status`(text not null default 'ready', check: ready/stale/failed)
- **인덱스:** unique(product_id), index(updated_at desc), index(status)
- **RLS:** service_role 전체, anon은 select만

---

## 3. 요약 서비스 구조

**파일:** `src/lib/reviewSummaries.ts`

| 함수 | 용도 |
|------|------|
| `getProductReviewSummary(productId)` | 상품별 요약 1건 조회(anon, 상세 카드용) |
| `upsertProductReviewSummary(productId, payload)` | 요약 upsert(관리자/재생성 API) |
| `markProductReviewSummaryStale(productId)` | 해당 상품 요약을 stale로 표시 |
| `getSummarySourceReviews(productId, options?)` | 요약용 소스 리뷰 목록(submitted, 해당 상품, limit 기본 200) |
| `getReviewSummariesList(options?)` | 관리자용 요약 목록(updated_at 내림차순) |

- 읽기: `supabase`(anon). 쓰기/목록: `supabaseAdmin`.
- 요약 대상: submitted, hidden 제외, 해당 product_id. 리뷰 2건 미만이면 생성 생략 권장.

---

## 4. AI 요약 생성 방식

**파일:** `src/lib/ai/reviewSummary.ts`

- **1차:** rule-based fallback(LLM 미사용).  
  - `content_good` / `content_bad` / `content_tip` 기반 문장·키워드 추출.  
  - 긍정 2~4개, 아쉬운 0~3개, 추천 1~3개, summaryText 2~4문장.
- **인터페이스:** `generateProductReviewSummary(productId)`, `generateAndBuildPayload(productId)` — 추후 LLM 교체 시 동일 시그니처로 교체 가능.
- **정책:** 리뷰 2건 미만이면 `null` 반환(생략). 상품 없으면 `null`.

---

## 5. Stale / Regenerate 정책

- **Stale 처리:**  
  - 리뷰 submitted 생성/수정(드래프트→제출, PATCH submit),  
  - 관리자 hide/restore 시  
  → 해당 상품의 `product_id`에 대해 `markProductReviewSummaryStale(productId)` 호출.
- **실제 재생성:**  
  - 관리자 페이지 "재생성" 버튼 또는 상품 ID 입력 후 "요약 생성" →  
  - `POST /api/admin/products/[id]/review-summary` body `{ action: "regenerate" }` 호출.  
  - cron/batch는 이번 PR 미포함.

---

## 6. 관리자 UI

- **페이지:** `src/app/theall_manager_only/review-summaries/page.tsx`
- **기능:**  
  - 요약 목록 테이블: product_id, 상품명, status, 리뷰 수, 평균 평점, updated_at, 재생성 버튼.  
  - 상품 ID 입력 + "요약 생성" 버튼으로 해당 상품 요약 생성/재생성.
- **네비:** SubHeader·AdminLayout·sidebarConfig에 "리뷰 요약" 링크 추가.

---

## 7. 상품 상세 요약 카드

- **컴포넌트:** `ProductReviewSummaryCard` (`src/components/products/ProductReviewSummaryCard.tsx`)
- **노출 위치:** `ProductReviewsSection` 상단(여행 후기 제목 아래, 평점/후기 수 박스 위).
- **표시 조건:**  
  `getProductReviewSummary(productId)` 결과가  
  `status === 'ready'` && `review_count >= 2` && `summary_text` 존재할 때만 렌더.
- **UI:** "리뷰 한눈에 보기", 평균 평점·리뷰 수, 요약 문단, 좋아요/아쉬워요/이런 분께 추천, 하단 "AI가 리뷰를 바탕으로 요약한 내용입니다."

---

## 8. Fallback 처리

- 요약 없음/미표시: 카드에서 조건 미충족 시 `return null` → 리뷰 섹션은 기존대로 노출.
- 생성 실패: 재생성 API에서 실패 시 `status='failed'`로 upsert 후 400 반환 → 관리자 목록에서 상태 확인 및 재시도 가능.
- 리뷰 부족: `generateAndBuildPayload`가 `success: false` + reason 반환 → 동일하게 failed upsert 후 400.

---

## 9. 테스트 시나리오

1. **공개 리뷰 3건 이상 상품**  
   관리자에서 해당 상품 요약 생성 → `product_review_summaries`에 row upsert → 상품 상세에 리뷰 요약 카드 표시 확인.

2. **리뷰 적은 상품**  
   리뷰 1~2건 이하 상품은 요약 미생성 또는 카드 미표시 확인.

3. **리뷰 변경 후 stale**  
   새 리뷰 submitted 또는 기존 리뷰 submit 수정 → 해당 product_id의 summary `status = 'stale'` 확인.

4. **리뷰 숨김/복구**  
   hide → stale, restore → stale. 재생성 후 `status = 'ready'` 확인.

5. **관리자 재생성**  
   `POST /api/admin/products/[id]/review-summary` body `{ action: "regenerate" }` → 성공 시 200, reviewCount/averageRating/status 반환.

6. **AI(생성) 실패**  
   실패 시 해당 상품 요약이 `status = 'failed'`로 저장되고, 상품 상세에는 카드 미표시, 관리자에서 재시도 가능한지 확인.

---

(PR14 완료)
