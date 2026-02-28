# [STEP 9] 여행가이드(Guide) 엔티티에 pdfUrl/thumbnailUrl 저장 설계

## 전제

- 여행가이드 등록 페이지는 상품 등록과 별개
- Guide는 Product와 무관한 별도 엔티티

---

## 1. 탐색 결과: 기존 Guide 도메인 존재

### 1.1 타입

| 파일 | 내용 |
|------|------|
| `src/types/guide.ts` | `Guide` 타입 정의 (id, title, summary, thumbnail_url, landing_url, guide_pdf_url, guide_thumbnail_url, is_published, sort_order, created_at) |

### 1.2 API

| 경로 | 메서드 | 역할 |
|------|--------|------|
| `src/app/api/admin/guides/route.ts` | GET | 목록 조회 |
| `src/app/api/admin/guides/route.ts` | POST | 등록 |
| `src/app/api/admin/guides/[id]/route.ts` | PATCH | 수정 |
| `src/app/api/admin/guides/[id]/route.ts` | DELETE | 삭제 |
| `src/app/api/guides/route.ts` | GET | 공개용 목록 (is_published=true) |

### 1.3 DB

| 파일 | 내용 |
|------|------|
| `supabase/guides.sql` | `public.guides` 테이블 생성 (id, title, summary, thumbnail_url, landing_url, is_published, sort_order, created_at, updated_at) |
| `supabase/guides_pdf_fields.sql` | `guide_pdf_url`, `guide_thumbnail_url` 컬럼 추가 |

### 1.4 기타

| 파일 | 역할 |
|------|------|
| `src/lib/guides.ts` | `getPublishedGuides()`, `normalizeGuide()` |
| `src/components/AdminGuideManager.tsx` | 여행가이드 등록/수정 UI (PDF 업로드 포함) |
| `src/app/theall_manager_only/guides/page.tsx` | 관리자 페이지 |

---

## 2. 필드 매핑 (최소 필드 vs 기존 구조)

| 사용자 요청 (최소) | 기존 Guide 필드 | 비고 |
|-------------------|-----------------|------|
| id | id | ✓ |
| title | title | ✓ |
| pdf_url | **guide_pdf_url** | PDF 파일 URL. `guide_` 접두사로 기존 `thumbnail_url`과 구분 |
| thumbnail_url | **guide_thumbnail_url** | PDF 1페이지 썸네일 URL |
| created_at | created_at | ✓ |
| updated_at | updated_at | ✓ |

**참고**: `thumbnail_url`은 이미 가이드 카드/랜딩용 이미지로 사용 중이므로, PDF 썸네일은 `guide_thumbnail_url`로 구분.

---

## 3. Guide 스키마 (확장 후)

### 3.1 필수 필드 (최소)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| title | text | 제목 |
| guide_pdf_url | text | PDF 파일 URL (pdf_url에 해당) |
| guide_thumbnail_url | text | PDF 1페이지 썸네일 URL (thumbnail_url에 해당) |
| created_at | timestamptz | 생성일시 |
| updated_at | timestamptz | 수정일시 |

### 3.2 추가 필드 (기존)

| 필드 | 타입 | 설명 |
|------|------|------|
| summary | text | 요약 |
| thumbnail_url | text | 가이드 카드/랜딩 썸네일 |
| landing_url | text | 랜딩 URL |
| is_published | boolean | 공개 여부 |
| sort_order | integer | 정렬 순서 |

---

## 4. Admin API (프로젝트 conventions 준수)

| 메서드 | 경로 | 역할 |
|--------|------|------|
| GET | `/api/admin/guides` | 목록 조회 |
| POST | `/api/admin/guides` | 등록 |
| PATCH | `/api/admin/guides/[id]` | 수정 |
| DELETE | `/api/admin/guides/[id]` | 삭제 |

---

## 5. DB 마이그레이션

### 5.1 guides 테이블

- **이미 존재**: `supabase/guides.sql`로 생성됨
- **추가 컬럼**: `supabase/guides_pdf_fields.sql`로 `guide_pdf_url`, `guide_thumbnail_url` 추가

### 5.2 마이그레이션 실행 순서

1. `supabase/guides.sql` (테이블 생성)
2. `supabase/guides_pdf_fields.sql` (PDF 필드 추가)

---

## 6. 저장 대상 정리

| 구분 | 대상 |
|------|------|
| **엔티티** | `public.guides` |
| **PDF URL** | `guides.guide_pdf_url` |
| **PDF 썸네일 URL** | `guides.guide_thumbnail_url` |
| **등록 페이지** | `/theall_manager_only/guides` → `AdminGuideManager` |
| **저장 API** | `POST /api/admin/guides`, `PATCH /api/admin/guides/[id]` |

---

## 7. 완료 조건 체크

| 조건 | 상태 |
|------|------|
| 여행가이드 등록 페이지가 저장할 대상(Guide)이 명확함 | ✓ `public.guides` |
| pdf_url/thumbnail_url을 저장할 곳이 Guide 쪽으로 정리됨 | ✓ `guide_pdf_url`, `guide_thumbnail_url` |
| Admin API (POST, PATCH) 존재 | ✓ |
| DB 마이그레이션 정의됨 | ✓ `guides_pdf_fields.sql` |
