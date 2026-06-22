-- 180일(6개월) 경과 관리자 채팅 메시지 월별 자동 삭제
-- 사전 조건: Supabase 대시보드 → Database → Extensions 에서 pg_cron 활성화 (Pro 플랜)
-- pg_cron 미지원 환경에서는 Vercel Cron + /api/cron/purge-admin-chat API 대안 사용 가능

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.purge_old_admin_chat_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.admin_chat_messages
  WHERE created_at < now() - interval '180 days';
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_admin_chat_messages() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_old_admin_chat_messages() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-admin-chat-messages-monthly') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'purge-admin-chat-messages-monthly';
  END IF;
END;
$$;

SELECT cron.schedule(
  'purge-admin-chat-messages-monthly',
  '0 3 1 * *',
  $$SELECT public.purge_old_admin_chat_messages()$$
);
