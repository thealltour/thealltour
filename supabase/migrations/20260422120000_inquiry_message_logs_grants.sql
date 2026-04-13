-- inquiry_message_logs: anon/REST 접근 시 테이블 권한 누락으로 insert/select가 막히는 경우 보완
-- 주의: create migration(20260420120000_create_inquiry_message_logs.sql) 적용 이후 실행되어야 합니다.
-- 관리자 API는 service_role(supabaseAdmin)을 쓰면 RLS를 우회하므로 이 GRANT는 선택적입니다.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'inquiry_message_logs'
  ) then
    grant select, insert on public.inquiry_message_logs to anon;
    grant select, insert on public.inquiry_message_logs to authenticated;
  else
    raise notice 'public.inquiry_message_logs does not exist. Apply 20260420120000_create_inquiry_message_logs.sql first.';
  end if;
end $$;
