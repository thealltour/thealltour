-- 같은 스레드 게시글에서 동일 유저(user_handle)에게 자동 답글을 1회만 보내기 위한 유니크 인덱스.

create unique index if not exists idx_thread_marketing_replies_post_user
  on public.thread_marketing_replies (post_id, lower(user_handle))
  where user_handle is not null and btrim(user_handle) <> '';
