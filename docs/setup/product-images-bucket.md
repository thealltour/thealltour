# 상품 이미지 Bucket 설정 가이드

관리자 상품 이미지 업로드(`/api/admin/uploads/image`)에서 사용하는 Supabase Storage bucket 설정 방법입니다.

## 1. Bucket 생성 (Supabase SQL)

프로젝트 루트의 `supabase/product_images_bucket.sql`을 Supabase SQL Editor에서 실행합니다.

```sql
-- 상품 대표 이미지 업로드용 public bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  10485760,  -- 10MB
  array['image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
```

| 항목 | 값 | 설명 |
|------|-----|------|
| `id` | product-images | bucket 식별자 |
| `public` | true | public URL로 접근 가능 |
| `file_size_limit` | 10485760 (10MB) | 파일 최대 크기 |
| `allowed_mime_types` | image/webp, image/jpeg, image/png | 리사이즈 실패 시 원본 fallback 지원 |

## 2. 환경변수

`.env.local` 또는 배포 환경에 다음을 설정합니다.

| 변수 | 설명 |
|------|------|
| `STORAGE_PROVIDER` | `supabase` (현재 지원) |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 서비스 역할 키 (Storage 업로드용, **서버 전용**) |

> `NEXT_PUBLIC_SUPABASE_URL`이 있으면 `SUPABASE_URL` 대신 사용 가능합니다.

## 3. 보안

- **anon 업로드 차단**: RLS로 anon 직접 업로드를 막고, API(`/api/admin/uploads/image`) 경유로만 업로드합니다.
- **Admin 인증**: API는 middleware에서 `ADMIN_AUTH_COOKIE`를 검사하여 미인증 시 401을 반환합니다.
- **service_role**: Supabase Admin API는 `SUPABASE_SERVICE_ROLE_KEY`로 RLS를 우회하여 업로드합니다.

## 4. 여행가이드 PDF Bucket (선택)

`supabase/guide_pdfs_bucket.sql`을 실행하면 `guide-pdfs` bucket이 생성됩니다.  
`/api/admin/uploads/pdf`에서 PDF 업로드 시 사용합니다.

## 5. StorageProvider 교체

다른 스토리지(S3, R2 등)로 전환하려면:

1. `src/lib/storage/providers/`에 새 provider 클래스 추가 (예: `S3StorageProvider.ts`)
2. `IStorageProvider` 인터페이스 구현
3. `src/lib/storage/index.ts`의 `createProvider()`에 case 추가
4. `STORAGE_PROVIDER` 환경변수로 전환

API route(`/api/admin/uploads/image`)는 `getStorageProvider()`만 사용하므로 수정 없이 provider만 교체하면 됩니다.
