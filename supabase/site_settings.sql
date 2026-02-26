create table if not exists public.site_settings (
  key text primary key,
  value text not null default ''
);

comment on table public.site_settings is '사이트 전역 환경설정 (SNS 및 채널 URL 등)';
comment on column public.site_settings.key is '설정 키 (예: kakao_channel_url)';
comment on column public.site_settings.value is '설정 값';

alter table public.site_settings enable row level security;

drop policy if exists "site_settings_select_anon" on public.site_settings;
create policy "site_settings_select_anon"
on public.site_settings
for select
to anon
using (true);

drop policy if exists "site_settings_insert_anon" on public.site_settings;
create policy "site_settings_insert_anon"
on public.site_settings
for insert
to anon
with check (true);

drop policy if exists "site_settings_update_anon" on public.site_settings;
create policy "site_settings_update_anon"
on public.site_settings
for update
to anon
using (true)
with check (true);

drop policy if exists "site_settings_delete_anon" on public.site_settings;
create policy "site_settings_delete_anon"
on public.site_settings
for delete
to anon
using (true);

