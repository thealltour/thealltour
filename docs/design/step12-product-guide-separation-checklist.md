# [STEP 12] Product–Guide 분리 체크리스트

## 점검 결과: 모두 정리됨 ✓

### 1. Product 테이블 guide_pdf_url/guide_thumbnail_url 마이그레이션

| 항목 | 상태 |
|------|------|
| `products_guide_pdf_fields.sql` | **존재하지 않음** (이전에 폐기됨) |
| products 테이블에 guide_* 컬럼 | **없음** |

### 2. src/types/product.ts

| 항목 | 상태 |
|------|------|
| guide_pdf_url | **없음** |
| guide_thumbnail_url | **없음** |

### 3. /api/admin/products insert/update payload

| 항목 | 상태 |
|------|------|
| guide_pdf_url | **포함 안 함** |
| guide_thumbnail_url | **포함 안 함** |

※ `point_guide`는 상품 필드(인솔자)로, 여행가이드 PDF와 무관함.

### 4. AdminProductManager

| 항목 | 상태 |
|------|------|
| 여행가이드 PDF 섹션 | **없음** |
| GuidePdfUploadField 사용 | **없음** |

---

## 유지 항목 (확인됨)

| 항목 | 경로 |
|------|------|
| 가이드 업로드 API | `/api/admin/uploads/guide` |
| PDF 1페이지 썸네일 유틸 | `src/lib/pdf/renderFirstPageToWebp.ts` |
| Guide 타입 | `src/types/guide.ts` |
| guides 테이블 | `public.guides` (guide_pdf_url, guide_thumbnail_url) |
| guides API | `src/app/api/admin/guides/*` |
| AdminGuideManager | `src/components/AdminGuideManager.tsx` |
| 여행가이드 페이지 | `/blog`, `/theall_manager_only/guides` |

---

## 결론

- Product와 Guide가 분리된 상태로 유지됨
- 추가 제거 작업 불필요
