# PR11: 리뷰 SEO 시스템 구축 — 결과 정리

## 1. 수정 파일 목록

| 구분 | 경로 |
|------|------|
| **신규** | `src/lib/seo/reviews.ts` |
| **신규** | `src/lib/seo/products.ts` |
| **신규** | `src/app/reviews/claim/layout.tsx` |
| **수정** | `src/app/reviews/[id]/page.tsx` |
| **수정** | `src/app/reviews/page.tsx` |
| **수정** | `src/app/products/[id]/page.tsx` |
| **수정** | `src/app/reviews/write/page.tsx` |
| **수정** | `src/app/mypage/reviews/[id]/page.tsx` |

---

## 2. 각 파일별 변경 목적

- **`src/lib/seo/reviews.ts`**  
  리뷰 상세용 Review JSON-LD 생성, 리뷰 상세 메타데이터 생성, 리뷰 목록 메타/ canonical 생성.  
  (TODO: sitemap에 공개 리뷰 포함, internal linking 강화)

- **`src/lib/seo/products.ts`**  
  상품 상세용 Product + aggregateRating + review 배열 JSON-LD 생성.

- **`src/app/reviews/claim/layout.tsx`**  
  claim 토큰 페이지에 `robots: { index: false, follow: true }` 적용.

- **`src/app/reviews/[id]/page.tsx`**  
  generateMetadata 추가, Review JSON-LD 스크립트 삽입, 본문 semantic section/heading 정리.

- **`src/app/reviews/page.tsx`**  
  generateMetadata 추가(필터·상품명 반영), canonical / og / twitter 메타 설정.

- **`src/app/products/[id]/page.tsx`**  
  Product JSON-LD를 `buildProductReviewJsonLd` 기반으로 구성하고, aggregateRating·review 배열 추가.  
  (리뷰 0개면 aggregateRating 생략)

- **`src/app/reviews/write/page.tsx`**  
  `metadata.robots: { index: false, follow: true }` 추가.

- **`src/app/mypage/reviews/[id]/page.tsx`**  
  `metadata.robots: { index: false, follow: true }` 추가.

---

## 3. 공개 리뷰 상세 SEO 구현 내용

- **generateMetadata**  
  `getPublicReviewById(id)`로 조회. 없으면 `title: "후기를 찾을 수 없습니다 | 더올투어"`만 반환(이후 notFound).  
  있으면 `buildReviewDetailMetadata(review)`로 title, description, canonical, openGraph, twitter 설정.

- **Review JSON-LD (schema.org)**  
  `buildReviewJsonLd(review, { pageUrl })`로 생성 후 `<script type="application/ld+json">`으로 삽입.  
  포함 필드: `@context`, `@type: Review`, `headline`, `reviewBody`, `reviewRating`, `author`, `datePublished`, `itemReviewed`(상품명/상품 URL), `publisher`, `url`, `image`(있을 때).

- **본문 구조**  
  세부 평점 영역을 `<section aria-labelledby="detail-ratings-heading">`, 좋았던 점/아쉬웠던 점/여행 팁/추가 내용을 각각 `<section aria-labelledby="...">`와 `ContentSection`의 `id`로 연결.  
  `reviewBody`는 summary 우선, 없으면 content를 500자 이내로 truncate하여 사용.

- **안전성**  
  submitted만 노출하는 기존 로직 유지. review 없음 → notFound. description/본문은 truncate로 길이 제한.

---

## 4. 상품 상세 AggregateRating / Review JSON-LD 구현 내용

- **데이터 소스**  
  `getProductReviewStats(productId)`, `getProductReviews(productId, { limit: 3, sort: "latest" })`.

- **구성**  
  `buildProductReviewJsonLd(product, stats, reviews, { productUrl })`로 Product 스키마 생성.  
  - 항상: `@context`, `@type: Product`, `name`, `description`, `image`, `url`, `brand`.  
  - `stats.reviewCount > 0`일 때만 `aggregateRating` (ratingValue, reviewCount, bestRating 5, worstRating 1).  
  - 최근 리뷰 최대 3건을 `review` 배열로 포함 (author, datePublished, reviewBody 300자 제한, reviewRating).

- **기존 Product JSON-LD와 통합**  
  위 결과에 `category`, `offers`(가격 등)를 spread로 추가해 기존 상품 페이지 스크립트와 동일한 위치에 출력.  
  리뷰 0개 상품은 aggregateRating·review 없이 Product만 출력.

---

## 5. 리뷰 목록 SEO 구현 내용

- **generateMetadata**  
  `searchParams`에서 `verified`, `photos`, `productId` 추출.  
  `productId`가 있으면 `getProductByIdFresh(productId)`로 상품 제목 조회.  
  `buildReviewListMetadata({ productId, productTitle, onlyVerified, onlyWithImages })`로 title, description, canonical 계산.

- **title 규칙**  
  - 기본: `여행 후기 | 더올투어`  
  - 특정 상품: `{상품명} 후기 모음 | 더올투어`  
  - 인증만: `인증된 여행 후기 모음 | 더올투어`  
  - 사진만: `사진 여행 후기 모음 | 더올투어`

- **canonical**  
  - `productId` 있음: `/reviews?productId={id}`  
  - 없음: `/reviews`  
  (정렬 등 단순 파라미터는 canonical에서 제외해 기본 목록으로 통일.)

- **openGraph / twitter**  
  title, description, url(canonical), siteName, type: website, twitter card: summary_large_image.

---

## 6. canonical / og / twitter 처리 방식

- **공개 리뷰 상세 (`/reviews/[id]`)**  
  canonical: `{siteUrl}/reviews/{id}`.  
  og: title, description, url, type: article, siteName, images(리뷰 첫 이미지 또는 사이트 기본 이미지), locale: ko_KR.  
  twitter: card: summary_large_image, title, description, images.

- **상품 상세 (`/products/[id]`)**  
  기존 generateMetadata 유지. canonical, openGraph, twitter 이미 구현됨.  
  이번 PR에서는 Product JSON-LD만 확장(aggregateRating, review).

- **리뷰 목록 (`/reviews`)**  
  canonical은 필터에 따라 위와 같이 설정. og/twitter는 목록용 title/description/canonical 사용.

- **이미지**  
  리뷰 상세: 리뷰 이미지 있으면 첫 장, 없으면 `/thealltour-logo.png`.  
  상품 상세: 상품 대표 이미지 또는 동일 fallback.

---

## 7. noindex 적용 내용

- **`/reviews/write`**  
  `export const metadata: Metadata = { robots: { index: false, follow: true } }`.

- **`/reviews/claim/[token]`**  
  `src/app/reviews/claim/layout.tsx`에서 동일 `metadata.robots` 적용.  
  (claim 페이지는 client component이므로 layout에서 메타 설정.)

- **`/mypage/reviews/[id]`**  
  `export const metadata: Metadata = { robots: { index: false, follow: true } }`.

- **hidden/draft 리뷰**  
  공개 상세는 기존대로 `getPublicReviewById`만 사용. null이면 notFound.  
  별도 noindex 설정 없이 노출 자체가 되지 않음.

---

## 8. 테스트 시나리오

1. **공개 리뷰 상세 SEO**  
   - `/reviews/[id]`(submitted 리뷰)에서 페이지 소스 확인.  
   - `<script type="application/ld+json">` 내부에 `"@type":"Review"`, reviewBody, reviewRating, author, datePublished, itemReviewed 등 존재 여부 확인.  
   - 메타: title, description, canonical, og:title, og:description, og:image, twitter:card 등 확인.

2. **상품 상세 SEO**  
   - 리뷰가 있는 상품: JSON-LD에 `aggregateRating`, `review` 배열(최대 3개) 포함 여부 확인.  
   - 리뷰가 없는 상품: `aggregateRating`/`review` 없이 Product만 있는지 확인.

3. **리뷰 목록 SEO**  
   - `/reviews`: title "여행 후기 | 더올투어", canonical `/reviews`.  
   - `?verified=1`: title "인증된 여행 후기 모음 | 더올투어".  
   - `?productId=xxx`: 해당 상품 제목으로 "OOO 후기 모음", canonical에 productId 포함.

4. **noindex**  
   - `/reviews/write`, `/reviews/claim/[token]`, `/mypage/reviews/[id]` 응답 헤더 또는 HTML 메타에 `robots` noindex 포함 여부 확인.

5. **hidden/draft 보호**  
   - hidden/draft 리뷰 ID로 `/reviews/[id]` 접근 시 404 유지.

---

## 9. 남은 TODO

- **sitemap**  
  공개 리뷰 상세 URL을 sitemap에 포함해 검색 엔진 수집 대상으로 추가.  
  (코드 내 주석: `src/lib/seo/reviews.ts`)

- **internal linking**  
  리뷰 수가 많은 상품부터 상품 상세 ↔ 리뷰 상세 간 내부 링크 강화.  
  (현재 상품 상세·리뷰 상세에 이미 상호 링크 있음. 추후 리뷰 수 기반 노출 우선순위 등 확장 가능.)

- **이미지 정책**  
  OG 이미지 없을 때 사이트 기본 이미지 fallback은 적용됨.  
  필요 시 `NEXT_PUBLIC_SITE_URL` 기반 절대 URL 정책만 통일하면 됨.
