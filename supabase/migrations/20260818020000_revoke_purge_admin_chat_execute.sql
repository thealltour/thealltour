-- Security Advisor 0028/0029:
-- public.purge_old_admin_chat_messages() 는 SECURITY DEFINER 이며
-- 관리자 채팅 메시지 일괄 삭제 전용이다. PostgREST RPC로 anon/authenticated가
-- 호출할 수 있으면 안 된다.
-- 기존 마이그레이션은 PUBLIC만 revoke 해서, default privilege로 부여된
-- anon/authenticated EXECUTE가 남을 수 있다.

revoke all on function public.purge_old_admin_chat_messages()
  from public, anon, authenticated;

grant execute on function public.purge_old_admin_chat_messages()
  to service_role;
