-- Chrome 익스텐션 ZIP (관리자 전용 다운로드)
-- 업로드: scripts/upload-extension-builds.mjs (service_role)
-- 다운로드: /api/admin/tools/extensions/[slug]/download
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'extension-builds',
  'extension-builds',
  false,
  52428800,
  array['application/zip', 'application/x-zip-compressed', 'application/octet-stream', 'application/json']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
