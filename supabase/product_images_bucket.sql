-- 상품 대표 이미지 업로드용 public bucket
-- Admin API(/api/admin/uploads/image)에서 StorageProvider 경유로만 사용
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  10485760,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- service_role은 RLS를 우회하므로 별도 policy 불필요
-- anon 업로드 차단을 위해 insert policy는 service_role만 사용 (API 경유)
