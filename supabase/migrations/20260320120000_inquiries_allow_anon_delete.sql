-- 문의 삭제: 관리자 UI에서 DELETE /api/inquiries/:id 시 anon 키로 삭제 가능하도록
-- (기존 insert/select/update와 동일하게 서버의 anon 클라이언트 사용 전제)
drop policy if exists "Allow public delete inquiries" on public.inquiries;
create policy "Allow public delete inquiries"
on public.inquiries
for delete
to anon
using (true);
