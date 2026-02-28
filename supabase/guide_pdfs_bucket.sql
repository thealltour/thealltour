-- 여행가이드 PDF/썸네일 업로드용 public bucket
-- Admin API(/api/admin/uploads/pdf, /api/admin/uploads/guide)에서 StorageProvider 경유로만 사용
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'guide-pdfs',
  'guide-pdfs',
  true,
  10485760,
  array['application/pdf', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
