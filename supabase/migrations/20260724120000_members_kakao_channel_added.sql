-- 카카오싱크 필수 동의항목(plusfriends) — 채널 추가 여부 저장

alter table public.members
  add column if not exists kakao_channel_added boolean;

comment on column public.members.kakao_channel_added is
  '카카오톡 채널 추가 상태(plusfriends). true=추가됨, false=미추가/차단, null=미확인';
