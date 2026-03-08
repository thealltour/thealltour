# PR6: 리뷰 노출 시스템 구축 — 결과 정리

## 1. 수정·추가 파일 목록

| 구분 | 파일 경로 |
|------|-----------|
| **추가** | `src/types/review.ts` (PublicReviewItem, ProductReviewStats, ReviewSortOption, ReviewFilterOption 추가) |
| **추가** | `src/lib/reviewStats.ts` |
| **추가** | `src/components/products/ProductReviewsSection.tsx` |
| **추가** | `src/components/reviews/ReviewListFilters.tsx` |
| **추가** | `src/components/reviews/PublicReviewCard.tsx` |
| **추가** | `src/app/reviews/[id]/page.tsx` (공개 리뷰 상세) |
| **수정** | `src/app/products/[id]/page.tsx` |
| **수정** | `src/components/products/ProductDetailV2.tsx` |
| **수정** | `src/app/reviews/page.tsx` |

---

## 2. 각 파일별 변경 목적

- **src/types/review.ts**  
  공개 노출 전용 타입 추가: `PublicReviewItem`, `ProductReviewStats`, `ReviewSortOption`, `ReviewFilterOption`.  
  공개 목록/상세와 내부·마이페이지용 타입 분리.

- **src/lib/reviewStats.ts**  
  공개용 리뷰 조회·집계만 담당.  
  `getPublicReviews`, `getProductReviewStats`, `getProductReviews`, `getPublicReviewById`, `isVerifiedReview` 제공.  
  **submitted만** 대상, draft/hidden 제외.  
  상품별 집계는 `travel_bookings.product_id` 기준으로 `booking_id` 매칭 후 집계.

- **src/components/products/ProductReviewsSection.tsx**  
  상품 상세 하단 “여행 후기” 섹션.  
  평균 평점·후기 수·인증 후기 수, 최근 5건 미리보기 카드, “전체 후기 보기” CTA.  
  리뷰 0개일 때 “아직 등록된 후기가 없습니다” 문구 표시.

- **src/components/reviews/ReviewListFilters.tsx**  
  리뷰 목록 정렬·필터 UI (클라이언트).  
  정렬: 최신순 / 평점 높은순 / 평점 낮은순 / 인증 후기 우선.  
  필터: 인증 후기만, 사진 후기만, 최소 별점(5점 / 4점 이상 / 3점 이상).  
  `searchParams` 기반으로 URL 갱신, `productId` 유지.

- **src/components/reviews/PublicReviewCard.tsx**  
  공개 목록용 카드.  
  제목, summary, 작성일, 평점, 인증 후기 배지, 본문 일부, 썸네일 최대 3장, 상품명(있을 때).  
  클릭 시 `/reviews/[id]`로 이동.

- **src/app/reviews/[id]/page.tsx**  
  공개 리뷰 상세 페이지.  
  `getPublicReviewById(id)`로 **submitted만** 조회, 없으면 404.  
  제목, summary, 작성일, 평점, 세부 평점, 인증 후기 배지, 이미지 그리드, 좋았던 점/아쉬웠던 점/여행 팁, content fallback.  
  마이페이지 상세(`/mypage/reviews/[id]`)와 분리.

- **src/app/products/[id]/page.tsx**  
  `getProductReviewStats(product.id)` 호출 추가.  
  `ProductReviewsSection` 항상 렌더(리뷰 0개 포함).  
  `ProductDetailV2`에 `reviewSummary` 전달해 제목 근처 평점 칩 노출.

- **src/components/products/ProductDetailV2.tsx**  
  선택 prop `reviewSummary?: { averageRating, reviewCount }` 추가.  
  값이 있으면 제목 아래 “★ 4.8 (후기 23)” 칩 노출, 클릭 시 `#reviews`로 스크롤.

- **src/app/reviews/page.tsx**  
  `getReviews()` 제거, `getPublicReviews(options)` 사용.  
  `searchParams`: sort, verified, photos, minRating, productId.  
  `ReviewListFilters`(Suspense 래핑), `PublicReviewCard`로 목록 렌더.  
  등록 후기 수는 공개(submitted) 건수만 표시.

---

## 3. 상품 상세 리뷰 섹션 구현 내용

- **위치**  
  상품 상세 본문(ProductDetailV2 섹션) 아래, 상담 안내 카드 위.

- **헤더**  
  제목: “여행 후기”  
  부제: “실제 여행자들의 생생한 후기를 확인하세요”

- **상단 요약**  
  `getProductReviewStats(productId)` 결과로 표시:  
  - 평균 평점 (소수점 1자리)  
  - 후기 개수  
  - 인증 후기 개수(0보다 클 때만)

- **카드**  
  `getProductReviews(productId, { limit: 5, sort: "latest" })`로 최근 5건.  
  카드당: 제목, summary(있으면), 작성일, 평점, “인증된 여행 후기” 배지(eligibility_id 있을 때), 본문 일부(2~3줄), 이미지 썸네일 최대 3장, “자세히 보기” 링크.

- **CTA**  
  “전체 후기 보기” → `/reviews?productId={productId}`

- **리뷰 0개**  
  동일 섹션에 “아직 등록된 후기가 없습니다.”만 표시.

- **평점 요약(제목 근처)**  
  `reviewSummary`가 있으면 ProductDetailV2에서 “★ 4.8 (후기 23)” 칩 노출, 클릭 시 `#reviews`로 스크롤.

---

## 4. 리뷰 목록 페이지 개선 내용

- **데이터**  
  기존 `getReviews()` 제거, **공개 전용** `getPublicReviews(options)`만 사용.  
  draft/hidden 제외, **submitted만** 노출.

- **정렬**  
  - 최신순 (latest)  
  - 평점 높은순 (rating_high)  
  - 평점 낮은순 (rating_low)  
  - 인증 후기 우선 (verified_first)

- **필터**  
  - 인증 후기만 (verified=1)  
  - 사진 후기만 (photos=1)  
  - 최소 별점 (minRating=5|4|3)  
  - 상품 기준 (productId=…, 상품 상세 “전체 후기 보기”에서 유입 시 유지)

- **카드**  
  `PublicReviewCard`: 제목, summary(있으면), 작성자, 작성일, 평점, 인증 후기 배지, 본문 일부, 이미지 썸네일(최대 3장), 상품명(있을 때).  
  카드 클릭 시 `/reviews/[id]`로 이동.

- **페이지네이션**  
  현재는 limit 50, offset 0 고정.  
  “더보기” 또는 페이지네이션은 추후 확장 가능하도록 옵션만 지원.

---

## 5. 리뷰 통계/집계 유틸 구현 내용

- **getPublicReviews(options)**  
  - 조건: `status = 'submitted'`  
  - 옵션: productId, onlyVerified, onlyWithImages, minRating, sort, limit, offset  
  - productId 있으면 `travel_bookings.product_id`로 booking id 목록 조회 후 `booking_id in (...)` 필터  
  - 정렬: DB order + 필요 시 verified_first는 메모리 보정  
  - onlyWithImages: image_urls 비어 있지 않거나 image_url 있는 경우만 (메모리 필터로 보완)  
  - 반환: `PublicReviewItem[]` (travel_bookings join으로 product_id, product_title 포함)

- **getProductReviewStats(productId)**  
  - 해당 상품의 booking_id에 연결된 submitted 리뷰만 집계  
  - 반환: averageRating, reviewCount, verifiedCount, photoCount, ratingDistribution(1~5)

- **getProductReviews(productId, options)**  
  - getPublicReviews({ productId, ...options }) 래퍼

- **getPublicReviewById(reviewId)**  
  - id + status = 'submitted' 단건 조회  
  - 없거나 draft/hidden이면 null → 상세 페이지에서 404

- **isVerifiedReview(review)**  
  - `review.eligibility_id` 존재 여부로 “인증된 여행 후기” 판단

- **공개 정책**  
  - 공개용 함수는 모두 **submitted만** 조회.  
  - 기존 `getReviews()` 등은 그대로 두고, 공개 노출은 reviewStats 전용 함수만 사용.

---

## 6. 인증 후기 표시 기준

- **기준**  
  `review.eligibility_id`가 있으면 인증 후기.

- **표시**  
  - 배지 문구: “인증된 여행 후기”  
  - 상품 상세 리뷰 섹션 카드, 리뷰 목록 카드, 공개 리뷰 상세 상단에서 동일 적용.

- **비인증(자유 작성)**  
  - eligibility_id 없으면 배지 없이 노출.  
  - 목록/상세에서 제외하지 않으며, 정렬에서 “인증 후기 우선” 시에만 순서만 조정.

---

## 7. 공개 리뷰 상세 처리 방식

- **라우트**  
  - 공개: `/reviews/[id]`  
  - 마이페이지: `/mypage/reviews/[id]` 유지

- **조회**  
  - `getPublicReviewById(id)`  
  - submitted만 반환, 없으면 null → notFound() (404)

- **표시**  
  - 제목, summary, 작성일, 평점, 세부 평점(있으면), “인증된 여행 후기” 배지  
  - 이미지 그리드 (image_urls 우선, 없으면 image_url fallback)  
  - 구조화: 좋았던 점 / 아쉬웠던 점 / 여행 팁  
  - content가 자동 생성 본문과 동일하면 “추가 내용”으로만 표시해 중복 방지  
  - 상품 연결 시 “상품 보기” 링크

- **접근 제어**  
  - draft/hidden은 getPublicReviewById에서 조회되지 않으므로 자동으로 404.

---

## 8. 하위호환 처리 내용

- **기존 자유 작성 리뷰**  
  - eligibility_id/booking_id 없어도 submitted면 공개 목록·상세에 노출.  
  - 인증 배지 없음.

- **content만 있는 리뷰**  
  - content_good/bad/tip 없으면 상세에서 content만 본문으로 표시.

- **image_url만 있는 레거시**  
  - toPublicReviewItem 및 카드/상세에서 `image_urls = image_url ? [image_url] : []` 로 fallback.

- **rating 없는 리뷰**  
  - rating optional 처리, “별점 없음” 또는 미표시로 처리해 깨지지 않음.

- **summary 없음**  
  - summary 필드 optional, 없으면 숨김.

- **getReviews() 유지**  
  - 기존 API/마이페이지 등은 기존 reviews.ts 함수 계속 사용.  
  - 공개 노출만 reviewStats + status=submitted로 분리.

---

## 9. 테스트 시나리오

1. **상품 상세 리뷰 섹션**  
   - 해당 상품에 submitted 리뷰가 3건 이상 있을 때: 평균 평점·후기 수·인증 후기 수 표시, 최근 5건 미리보기 노출.  
   - 인증 후기 배지 표시.  
   - “전체 후기 보기” 클릭 시 `/reviews?productId=…` 이동.  
   - 리뷰 0개일 때 “아직 등록된 후기가 없습니다” 표시.

2. **리뷰 목록**  
   - 최신순 / 평점 높은순 / 평점 낮은순 / 인증 후기 우선 전환 시 목록 순서 변경 확인.  
   - “인증 후기만”, “사진 후기만”, “4점 이상” 등 필터 적용 시 건수·내용 일치 확인.  
   - productId 유지된 상태에서 정렬/필터 변경 시 상품 필터 유지 확인.

3. **공개 리뷰 상세**  
   - submitted 리뷰 `/reviews/[id]` 접근 시 상세 정상 노출.  
   - draft/hidden 리뷰 id로 접근 시 404.

4. **하위호환**  
   - content만 있는 예전 리뷰 정상 노출.  
   - image_url만 있는 리뷰 이미지 표시.  
   - eligibility 없는 자유 작성 리뷰 정상 노출(배지 없음).

5. **상품 상세 연결**  
   - 제목 근처 “★ 4.8 (후기 23)” 클릭 시 후기 섹션으로 스크롤.  
   - “전체 후기 보기”로 목록 이동 후 해당 상품 필터 유지.

---

## 10. 남은 TODO

- **페이지네이션/더보기**  
  리뷰 목록 현재 limit 50 고정.  
  필요 시 offset 기반 페이지네이션 또는 “더보기” 버튼 추가.

- **상품별 리뷰 캐싱**  
  getProductReviewStats / getProductReviews 결과에 대한 캐시(예: revalidate 태그) 미적용.  
  필요 시 Next.js revalidatePath/revalidateTag 또는 별도 캐시 레이어 검토.

- **Supabase FK 조인**  
  `reviews` → `travel_bookings` 조인 시 Supabase가 `travel_bookings` 이름으로 노출하는지 실제 환경에서 한 번 확인 권장.  
  스키마에 따라 `reviews_booking_id_fkey` 등으로 alias 필요할 수 있음.

- **travel_bookings.product_id 타입**  
  baseline에서 product_id가 text인 경우, product.id(uuid)와 비교 시 타입 변환 일치 여부 확인.

- **이미지 UX**  
  목록/상세에서 드래그로 순서 변경, 라이트박스 등은 미구현.  
  필요 시 별도 이슈로 진행 가능.
