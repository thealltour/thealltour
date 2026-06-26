-- 관리자 채팅 이미지 첨부 (public URL — API 업로드 전용)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-chat-attachments',
  'admin-chat-attachments',
  true,
  10485760,
  array['image/webp', 'image/jpeg', 'image/png', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
