-- 밴드 상품 등록 시 zip/사진 원본을 브라우저에서 직접 업로드하는 임시(private) 버킷.
-- Vercel 서버리스 함수의 4.5MB 요청 본문 제한을 우회하기 위해 signed upload URL로만 쓴다.
-- 업로드: /api/admin/products/import-band/upload-url (signed URL 발급) → 브라우저가 직접 업로드
-- 다운로드/삭제: /api/admin/products/import-band 처리 중 service_role로만 (src/lib/admin/bandImport/bandImportStaging.ts)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'band-import-staging',
  'band-import-staging',
  false,
  104857600,
  array['application/zip', 'application/x-zip-compressed', 'application/octet-stream', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- service_role은 RLS를 우회하므로 별도 policy 불필요 (private 버킷, signed URL/token으로만 업로드·다운로드)
