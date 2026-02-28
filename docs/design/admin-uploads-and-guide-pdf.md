# Admin 업로드 및 여행가이드 PDF – 설계 문서 (STEP 0)

## 1. 목표 요약

| 구분 | 목표 |
|------|------|
| **상품 이미지** | AdminProductManager에서 파일 업로드 지원, image_url 단일 필드 유지 |
| **이미지 변환** | 업로드 시 card(800px) / hero(1920px) 2종 자동 생성, WebP quality 0.8 |
| **기본 동작** | 업로드 성공 시 heroUrl을 form.image_url에 자동 입력 |
| **확장성** | cardUrl 별도 필드 사용 가능하도록 구조 열어두기 |
| **여행가이드 PDF** | PDF 업로드 → guide_pdf_url, 1페이지 렌더 → guide_thumbnail_url |
| **가이드 UI** | 관리자 가이드 목록을 카드형으로, guide_thumbnail_url 썸네일 사용 |

**제약:** Admin UI는 Storage 직접 호출 금지. 반드시 `/api/admin/uploads/*` 경유.

---

## 2. 상품 이미지 업로드 (2종 변환)

### 2.1 현재 상태

- `ImageUploadField`: 클라이언트에서 1920px WebP 변환 후 단일 파일 업로드
- `POST /api/admin/uploads/image`: 단일 파일 수신 → Storage 업로드 → URL 1개 반환
- `form.image_url`에 hero URL 저장

### 2.2 목표 상태

| variant | max-width | format | quality | 용도 |
|---------|-----------|--------|---------|------|
| **card** | 800px | webp | 0.8 | 목록 카드 썸네일 (향후 card_url 필드) |
| **hero** | 1920px | webp | 0.8 | 상세 히어로, form.image_url |

**기본 동작:** 업로드 성공 시 `heroUrl`을 `form.image_url`에 자동 입력.

### 2.3 구현 방향

| 위치 | 역할 |
|------|------|
| **클라이언트** | 원본 → card(800) / hero(1920) 2종 변환 후 FormData로 전송 |
| **API** | `POST /api/admin/uploads/image` 확장: `file`(hero) + `fileCard`(card) 수신, 각각 업로드 후 `{ url, cardUrl? }` 반환 |
| **DB** | products.image_url 유지. (옵션) products.image_card_url 컬럼 추가 시 cardUrl 저장 |

**경로 규칙 (Storage):**

- hero: `products/{yyyy}/{mm}/{timestamp}-{random}.webp`
- card: `products/{yyyy}/{mm}/{timestamp}-{random}-card.webp`

### 2.4 수정 대상 파일

| 파일 | 수정 내용 |
|------|-----------|
| `src/lib/images/resizeAndConvertToWebp.ts` | `maxWidth` 파라미터 추가 또는 `resizeToCard`/`resizeToHero` 분리 |
| `src/components/admin/ImageUploadField.tsx` | 2종 변환, FormData에 file + fileCard 전송, `onUploaded(url, cardUrl?)` |
| `src/app/api/admin/uploads/image/route.ts` | fileCard 수신, 2개 업로드, `{ url, cardUrl }` 반환 |
| `AdminProductManager` | `onUploaded`에서 heroUrl → image_url, (옵션) cardUrl → image_card_url |

---

## 3. 여행가이드 PDF 업로드

### 3.1 현재 상태

- `guides` 테이블: `thumbnail_url`, `landing_url` (URL 직접 입력)
- `AdminGuideManager`: thumbnail_url/landing_url 텍스트 입력, 목록은 리스트형

### 3.2 목표 상태

| 필드 | 설명 |
|------|------|
| **guide_pdf_url** | PDF 파일 업로드 후 Storage URL |
| **guide_thumbnail_url** | PDF 1페이지를 WebP 이미지로 렌더링한 URL |

관리자 가이드 목록: **카드형** UI, `guide_thumbnail_url`을 썸네일로 사용.

### 3.3 PDF → 썸네일 생성

**서버 측 처리 필요** (브라우저에서 PDF 1페이지 → 이미지 변환은 제한적):

| 방식 | 장점 | 단점 |
|------|------|------|
| **pdf-lib + canvas (Node)** | 의존성 적음 | PDF 렌더 품질 제한 |
| **pdf2pic (GraphicsMagick/ImageMagick)** | 품질 좋음 | 시스템 의존성 |
| **Puppeteer** | 렌더 정확 | 무거움 |
| **Vercel/Edge** | - | 대용량 PDF/이미지 처리 제약 |

**권장:** `pdf-lib`로 1페이지 추출 → `pdf2pic` 또는 `sharp`로 WebP 변환. 또는 Vercel Serverless 제약을 고려해 **외부 서비스(예: Cloudinary PDF→이미지)** 활용 검토.

### 3.4 API 설계

| 엔드포인트 | 역할 |
|------------|------|
| `POST /api/admin/uploads/pdf` | PDF 수신 → Storage 업로드 → PDF 1페이지 WebP 변환 → Storage 업로드 → `{ pdfUrl, thumbnailUrl }` 반환 |

**요청:** `multipart/form-data`, field: `file` (application/pdf)

**응답:** `{ pdfUrl: string, thumbnailUrl: string }`

### 3.5 DB 스키마

```sql
-- guides 테이블 확장
alter table public.guides add column if not exists guide_pdf_url text;
alter table public.guides add column if not exists guide_thumbnail_url text;
```

### 3.6 Storage Bucket

- 기존 `product-images` 또는 별도 bucket `guide-pdfs`, `guide-thumbnails` 검토
- `product-images`와 동일한 public bucket 정책 적용 가능

### 3.7 수정 대상 파일

| 파일 | 수정 내용 |
|------|-----------|
| `supabase/guides_pdf_upgrade.sql` | guide_pdf_url, guide_thumbnail_url 컬럼 추가 |
| `src/types/guide.ts` | guide_pdf_url?, guide_thumbnail_url? 추가 |
| `src/app/api/admin/uploads/pdf/route.ts` | 신규: PDF 업로드 + 썸네일 생성 API |
| `src/lib/storage/` | PDF/썸네일용 path 생성 유틸 (필요 시) |
| `src/components/AdminGuideManager.tsx` | PDF 업로드 필드, 카드형 목록, guide_thumbnail_url 썸네일 |
| `src/app/api/admin/guides/route.ts` | guide_pdf_url, guide_thumbnail_url 처리 |
| `src/app/api/admin/guides/[id]/route.ts` | 동일 |
| `src/lib/guides.ts` | normalizeGuide에 새 필드 반영 |

---

## 4. 기술 스택 및 제약

| 항목 | 내용 |
|------|------|
| **프레임워크** | Next.js App Router, React 19, TypeScript, Tailwind v4 |
| **Storage** | Supabase (DB/인증/Storage) |
| **Admin API** | `/api/admin/*` (middleware에서 ADMIN_AUTH_COOKIE 검사) |
| **제약** | Admin UI는 Storage 직접 호출 금지. 반드시 `/api/admin/uploads/*` 경유 |

---

## 5. 구현 순서 제안

1. **상품 이미지 2종 변환**
   - resize 유틸 확장 (card 800 / hero 1920)
   - ImageUploadField 2종 업로드
   - API 확장 (file + fileCard → url + cardUrl)
   - form.image_url에 heroUrl 유지

2. **products.image_card_url (옵션)**
   - 상세: `docs/design/product-image-card-url-extension.md`
   - DB 컬럼 추가, AdminProductManager/API 확장, ProductCardV2 등에서 cardUrl 우선 사용

3. **여행가이드 PDF**
   - guides 스키마 확장
   - PDF 업로드 API (썸네일 생성 방식 결정 후 구현)
   - AdminGuideManager: PDF 업로드 필드 + 카드형 목록

---

## 6. 요약 표

| 구분 | 현재 | 목표 |
|------|------|------|
| **상품 이미지** | hero 1920 단일 | card 800 + hero 1920 |
| **form.image_url** | hero URL | hero URL (유지) |
| **cardUrl** | - | (옵션) 별도 필드 |
| **가이드** | thumbnail_url URL 입력 | PDF 업로드 → guide_pdf_url, guide_thumbnail_url |
| **가이드 목록** | 리스트형 | 카드형, guide_thumbnail_url 썸네일 |
