# PR15: 리뷰 추천 알고리즘 + 랭킹 시스템 결과

## 1. 수정/추가 파일 목록

### 신규
- `src/lib/reviewRanking.ts` — 추천 점수 계산, 정렬, explain

### 수정
- `src/types/review.ts` — `PublicReviewItem`에 `recommendationScore?`, `rankingSignals?` 추가
- `src/lib/reviewStats.ts` — `sort === "recommended"` 시 점수 기반 정렬 및 점수 부여
- `src/components/products/ProductReviewsSection.tsx` — Best Review 선정 주석 및 평점 미충족 시 1위 리뷰를 BEST로 사용

---

## 2. 추천 점수 계산식

**파일:** `src/lib/reviewRanking.ts` (상수 `WEIGHTS`)

| 항목 | 계산 | 비고 |
|------|------|------|
| 도움됨 | `helpfulCount * 5` | 가장 큰 비중 |
| 인증 후기 | `eligibility_id` 있으면 +15 | |
| 평점 | `(rating ?? 0) * 2` | 1~5 → 2~10 |
| 이미지 | 이미지 1장 이상이면 +3 | |
| 구조화 리뷰 | summary≥20자 또는 good/bad/tip 중 하나≥15자이면 +4 | |
| 신선도 | 30일 이내 +6, 90일 이내 +3, 180일 이내 +1, 그 외 0 | 보조 신호 |

**총점** = 위 항목 합계.  
비중 원칙: **helpfulCount > verified > rating > freshness**.  
동점 시: `helpfulCount DESC` → `rating DESC` → `created_at DESC`.

---

## 3. reviewStats 추천순 변경 내용

**파일:** `src/lib/reviewStats.ts`

- **변경 전:** `sort === "recommended"` 시 메모리 정렬만  
  `helpfulCount DESC` → `rating DESC` → `created_at DESC`.
- **변경 후:**
  1. `getPublicReviews`에서 `sort === "recommended"`일 때 최대 500건까지 조회(기존과 동일).
  2. `review_votes`로 `helpfulCount` 보강 후 `sortReviewsByRecommendation(items)` 호출.
  3. 반환 리뷰에 `recommendationScore` 부여(정렬 순서 = 점수 순).
- **유지:** `latest`, `rating_high`, `rating_low`, `verified_first` 동작 변경 없음.  
  공개 리뷰는 여전히 submitted만, hidden/draft 제외.

---

## 4. Best Review 선정 기준 변경 내용

**파일:** `src/components/products/ProductReviewsSection.tsx`

- **변경 전:** `getProductReviews(..., sort: "recommended")` 상위 중 `rating >= 4`인 첫 리뷰를 BEST로, 없으면 BEST 없이 상위 5건만 표시.
- **변경 후:**  
  - 동일하게 `sort: "recommended"`로 가져오며, 이 목록이 이미 **recommendationScore 내림차순**.
  - **BEST 후보:** 점수 순 상위 중 `rating >= 4`인 첫 리뷰.  
  - **없을 때:** 점수 1위 리뷰를 BEST로 사용 (`reviews[0]`).
- 정리: “점수 가장 높은 것 중 평점 4 이상 우선, 없으면 점수 1위”로 통일.

---

## 5. 점수 계산 예시 (5개)

아래는 `explainReviewScore(review)` 스타일로, 가상 리뷰에 대한 예시이다.

| 예시 | helpful | verified | rating | images | structured | freshness | **총점** |
|------|---------|----------|--------|--------|------------|------------|----------|
| A. 도움됨 많고 인증, 5점, 이미지·구조화, 2주 전 | 4×5=20 | 15 | 10 | 3 | 4 | 6 | **58** |
| B. 도움됨 2, 비인증, 5점, 이미지 없음, 1개월 내 | 10 | 0 | 10 | 0 | 4 | 6 | **30** |
| C. 도움됨 0, 인증, 4점, 이미지 있음, 3개월 내 | 0 | 15 | 8 | 3 | 0 | 3 | **29** |
| D. 도움됨 1, 비인증, 5점, 6개월 전 | 5 | 0 | 10 | 0 | 0 | 1 | **16** |
| E. 도움됨 0, 비인증, 3점, 1년 전 | 0 | 0 | 6 | 0 | 0 | 0 | **6** |

- **A:** 도움됨+인증+평점+품질+신선도 모두 반영 → 상단 노출.
- **B:** 도움됨은 적지만 인증 없이도 구조화+신선도로 중위권.
- **C:** 도움됨 0이어도 인증+평점+이미지로 상위 가능.
- **D:** 오래됐지만 도움됨 1과 평점으로 하위 상단.
- **E:** 신호가 거의 없어 하위.

→ **helpfulCount가 높은 오래된 리뷰도** (예: helpful 10, 1년 전) 50+6=56으로 상단 유지 가능.

---

## 6. 하위호환 처리 내용

- **PublicReviewItem:** `recommendationScore`, `rankingSignals`는 optional.  
  기존 필드만 쓰는 코드는 수정 없이 동작.
- **정렬 옵션:** `latest` / `rating_high` / `rating_low` / `verified_first` 시에는 점수 계산·부여 없음.  
  `recommended`일 때만 점수 계산 및 부여.
- **Best Review:**  
  - 이전: “추천순 상위 중 rating≥4인 첫 리뷰” 또는 없으면 BEST 없음.  
  - 현재: “추천순(점수순) 상위 중 rating≥4인 첫 리뷰, 없으면 점수 1위”로 동작만 명확히 함.  
  API/프론트 계약 변경 없음.
- **PR8/PR9/PR14:**  
  - helpful 집계·노출 그대로 사용.  
  - hidden/draft는 `getPublicReviews` 단계에서 이미 제외되므로 점수 계산 대상에 포함되지 않음.  
  - AI 요약은 상품 단위이며, 개별 리뷰 점수와 무관.

---

## 7. 테스트 시나리오

1. **추천순 정렬 기본**  
   - 도움됨이 많은 리뷰가 상단에 오는지 확인.  
   - 도움됨이 같을 때 평점·최신순 tie-break 동작 확인.

2. **인증 후기 가산**  
   - 도움됨이 비슷한 경우 인증 후기가 소폭 상단에 오는지 확인.

3. **이미지/구조화 리뷰 가산**  
   - 동일한 도움됨 조건에서 내용·이미지가 있는 리뷰가 더 위로 오는지 확인.

4. **오래됐지만 좋은 리뷰**  
   - 오래됐지만 도움됨이 높은 리뷰가 상단을 유지하는지 확인.

5. **Best Review**  
   - 상품 상세에서 점수 기준으로 적절한 리뷰가 BEST REVIEW로 선택되는지,  
     평점 4 이상이 없을 때는 점수 1위가 BEST로 나오는지 확인.

6. **hidden/draft 보호**  
   - hidden/draft 리뷰가 추천순/점수 계산 결과에 포함되지 않는지 확인  
     (공개 조회는 기존대로 submitted만).

---

## 8. 남은 TODO

- **가중치 조정:**  
  `src/lib/reviewRanking.ts`의 `WEIGHTS`를 운영 데이터에 맞게 조정할 수 있음.  
  필요 시 환경 변수나 설정 테이블로 분리 가능.
- **Materialized view:**  
  추후 트래픽이 크면 `recommendation_score` 컬럼 또는 materialized view로 사전 계산·인덱스 검토.
- **관리자/디버그:**  
  필요 시 `explainReviewScore`를 활용한 관리자용 점수 상세 API  
  (예: `GET /api/admin/reviews/[id]/score`) 추가 가능.
- **UI 노출:**  
  점수/구성요소는 현재 UI에 노출하지 않음.  
  필요 시 `rankingSignals` 등으로 “왜 이 리뷰가 추천되는지” 문구 연동 가능.

---

(PR15 완료)
