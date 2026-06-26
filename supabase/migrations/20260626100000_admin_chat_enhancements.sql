-- 채팅: 이미지 첨부 + 푸시 알림 옵션

alter table public.admin_chat_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists attachment_urls jsonb not null default '[]'::jsonb;

alter table public.admin_chat_messages
  drop constraint if exists admin_chat_messages_message_type_check;

alter table public.admin_chat_messages
  add constraint admin_chat_messages_message_type_check
  check (message_type in ('text', 'image', 'mixed'));

alter table public.admin_push_subscriptions
  add column if not exists chat_enabled boolean not null default true;

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
