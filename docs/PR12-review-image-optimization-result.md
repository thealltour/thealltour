# PR12: 리뷰 이미지 최적화 시스템 구축 - 결과 정리

## 1. 수정 파일 목록

| 구분 | 파일 |
|------|------|
| **신규** | `src/lib/reviewImagePolicy.ts` |
| **신규** | `src/lib/reviewImageUploadServer.ts` |
| **신규** | `src/app/api/reviews/upload-image/route.ts` |
| **신규** | `src/components/reviews/ReviewDetailImages.tsx` |
| **수정** | `src/lib/reviewImageUpload.ts` |
| **수정** | `src/components/ReviewWriteForm.tsx` |
| **수정** | `src/components/ReviewItemActions.tsx` |
| **수정** | `src/components/reviews/PublicReviewCard.tsx` |
| **수정** | `src/components/products/ProductReviewsSection.tsx` |
| **수정** | `src/app/reviews/[id]/page.tsx` |
| **수정** | `src/lib/seo/reviews.ts` |
| **의존성** | `package.json` (sharp, browser-image-compression, react-photo-view 추가) |

---

## 2. 이미지 처리 구조 설명

- **클라이언트 (업로드 전)**
  - `browser-image-compression`: 최대 1600px 리사이즈, 품질 0.85 적용.
  - 선택된 파일만 압축 후 미리보기용 blob URL로 상태 유지.
- **업로드**
  - `uploadReviewImage(file, reviewId, index)` → `POST /api/reviews/upload-image` (FormData).
  - 리뷰 ID가 없으면 먼저 draft 생성 후 업로드(임시저장/등록 시 동일).
- **서버**
  - `sharp`: 원본 버퍼로부터 **original(1600) / medium(900) / thumb(400)** WebP 생성.
  - Supabase Storage에 `review-images/{review_id}/{original|medium|thumb}/{index}.webp` 업로드.
  - 응답으로 **medium URL** 반환 → DB `image_urls`에는 medium 기준 저장.

---

## 3. Supabase Storage 구조

- **버킷**: `review-images`
- **경로 규칙**  
  `review-images/{review_id}/{size}/{filename}.webp`  
  - `size`: `original` | `medium` | `thumb`
  - `filename`: `0.webp`, `1.webp`, … (인덱스 기반)
- **예시**
  - `review-images/abc123/original/0.webp`
  - `review-images/abc123/medium/0.webp`
  - `review-images/abc123/thumb/0.webp`
- **DB 저장**: `reviews.image_urls`에는 **medium URL**만 저장. 목록/상세 공통 사용, 확대 시 original 사용.

---

## 4. 업로드 리사이즈 로직

| 단계 | 위치 | 내용 |
|------|------|------|
| 1 | 클라이언트 (`ReviewWriteForm`) | `imageCompression(file, { maxWidthOrHeight: 1600, initialQuality: 0.85, useWebWorker: true })` |
| 2 | API (`/api/reviews/upload-image`) | 세션·리뷰 소유권 검증, 파일 타입/크기 검증 |
| 3 | 서버 (`reviewImageUploadServer`) | `sharp`: rotate → resize(withoutEnlargement) → webp(quality 85) |
| 4 | 서버 | original 1600px, medium 900px, thumb 400px 각각 생성 후 Storage 업로드 |
| 5 | 응답 | `url`(medium) 반환 → 클라이언트가 `image_urls`에 추가 후 PATCH/POST |

---

## 5. Next.js Image 적용 내용

- **PublicReviewCard**
  - 대표 이미지: `sizes="(max-width: 768px) 50vw, 33vw"`, `loading="lazy"`, `alt` = `{상품명} 여행 후기 사진` 또는 `여행 후기 사진`.
  - 나머지 썸네일: `sizes="48px"`, `loading="lazy"`.
- **ProductReviewsSection**
  - 카드 내 이미지: `sizes="64px"`, `loading="lazy"`, `alt` = `{상품명} 여행 후기 이미지` 또는 `여행 후기 이미지`.
- **리뷰 상세 (`ReviewDetailImages`)**
  - 첫 이미지: `priority` (LCP 개선).
  - 나머지: `loading="lazy"`, `sizes="(max-width: 640px) 50vw, 25vw"`.
  - `alt`: `{상품명} 여행 후기 사진 {n}`.

---

## 6. Lightbox UX

- **구성**: `react-photo-view` (`PhotoProvider` + `PhotoView`).
- **동작**: 그리드 이미지 클릭 시 lightbox 오픈.
- **표시 URL**: `mediumUrlToOriginalUrl(mediumUrl)`로 **original URL** 사용 (확대 시 고해상도).
- **파일**: `src/components/reviews/ReviewDetailImages.tsx` (클라이언트 컴포넌트).
- **스타일**: `react-photo-view/dist/react-photo-view.css` import.

---

## 7. 성능 개선 효과

- **업로드 전**: 클라이언트 리사이즈(1600px) + 품질 0.85 → 대용량 모바일 사진(3~10MB) 감소.
- **저장 포맷**: WebP + 3단계(thumb/medium/original) → 목록은 작은 파일, 상세/확대만 큰 파일 로드.
- **목록**: thumb/medium + lazy loading → LCP·대역폭 개선.
- **상세**: 첫 장 priority, 나머지 lazy → LCP 안정화.
- **목표**: 기존 3~10MB 수준 → 200~400KB 수준으로 용량 축소 기대.

---

## 8. 테스트 시나리오

1. **이미지 업로드**
   - 5MB 사진 선택 → 클라이언트 압축 후 미리보기 확인.
   - 임시저장 또는 등록 → WebP 변환 및 1600px 이하 리사이즈 확인(Network/Storage).
2. **Storage 구조**
   - Supabase Storage에서 `review-images/{review_id}/` 하위에 `original`, `medium`, `thumb` 폴더 및 `.webp` 파일 생성 확인.
3. **리뷰 목록**
   - 목록 페이지에서 썸네일 로딩 속도 확인.
   - `loading="lazy"` 동작 확인(뷰포트 밖 이미지 지연 로드).
4. **리뷰 상세**
   - 상세 페이지에서 medium 이미지 표시 확인.
   - 이미지 클릭 → lightbox에서 original(고해상도) 표시 확인.
5. **SEO**
   - 페이지 소스에서 `img` `alt` 값 확인 (`{상품명} 여행 후기 사진` 등).
   - JSON-LD `image` 필드에 original URL 포함 여부 확인 (`mediumUrlToOriginalUrl` 적용).

---

## 참고: 기존 이미지(레거시 URL)

- 이미 `image_urls`에 저장된 레거시 URL(예: `public/...` 단일 경로)은 그대로 사용.
- `mediumUrlToOriginalUrl`은 경로에 `/medium/`이 있을 때만 `/original/`로 치환하며, 레거시 URL은 변경 없음.
- 신규 업로드분만 `review-images/{review_id}/{size}/` 구조 적용.
