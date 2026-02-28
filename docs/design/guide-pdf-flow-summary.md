# 여행가이드 PDF 업로드/저장 플로우 – 정리

## 1. 확정된 파일 경로

여행가이드는 **Product와 무관한 별도 엔티티(guides)** 이며, 업로드/저장 플로우는 아래에만 존재합니다.

| 구분 | 경로 | 역할 |
|------|------|------|
| **관리자 UI** | `src/components/AdminGuideManager.tsx` | 여행가이드 등록/수정 폼. PDF 업로드, 썸네일 자동 생성 |
| **API (저장)** | `src/app/api/admin/guides/route.ts` | POST: 가이드 등록 |
| **API (수정)** | `src/app/api/admin/guides/[id]/route.ts` | PATCH: 가이드 수정 |
| **API (업로드)** | `src/app/api/admin/uploads/guide/route.ts` | PDF + thumb 업로드 → `{ pdfUrl, thumbnailUrl }` |
| **유틸** | `src/lib/pdf/renderFirstPageToWebp.ts` | PDF 1페이지 → WebP 썸네일 (클라이언트) |
| **타입** | `src/types/guide.ts` | Guide: guide_pdf_url?, guide_thumbnail_url? |
| **DB** | `public.guides` | guide_pdf_url, guide_thumbnail_url 컬럼 |
| **마이그레이션** | `supabase/guides_pdf_fields.sql` | guides 테이블에 컬럼 추가 |

## 2. Product 쪽 제거 대상 (완료)

Product는 상품 엔티티이며, 여행가이드 PDF와 무관합니다. 아래는 이미 제거된 항목입니다.

| 항목 | 상태 |
|------|------|
| `products.guide_pdf_url` | 제거됨 (마이그레이션 미배포, `products_guide_pdf_fields.sql` 폐기) |
| `products.guide_thumbnail_url` | 제거됨 |
| `Product` 타입의 guide_* 필드 | 제거됨 |
| `ProductFormState`의 guide_* 필드 | 제거됨 |
| `AdminProductManager`의 여행가이드 PDF 섹션 | 제거됨 |
| `src/app/api/admin/products/*`의 guide_* 처리 | 제거됨 |
| `src/lib/products.ts`의 guide_* 매핑 | 제거됨 |

## 3. 유지 항목

| 항목 | 경로 |
|------|------|
| PDF 1페이지 썸네일 유틸 | `src/lib/pdf/renderFirstPageToWebp.ts` |
| 가이드 업로드 API | `src/app/api/admin/uploads/guide/route.ts` |
| guide-pdfs bucket | `supabase/guide_pdfs_bucket.sql` |

## 4. 플로우 요약

1. 관리자: `/theall_manager_only/guides` → AdminGuideManager
2. PDF 선택 → `renderFirstPageToWebp(file)` → thumbFile 생성
3. FormData(pdf, thumb) → `POST /api/admin/uploads/guide`
4. 응답 `{ pdfUrl, thumbnailUrl }` → form에 반영
5. 저장 시 `POST /api/admin/guides` 또는 `PATCH /api/admin/guides/[id]`로 guide_pdf_url, guide_thumbnail_url 전송
