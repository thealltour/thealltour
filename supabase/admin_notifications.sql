create extension if not exists "pgcrypto";

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text not null,
  target_url text,
  unique_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_notifications_created_at on public.admin_notifications(created_at desc);
create index if not exists idx_admin_notifications_is_read on public.admin_notifications(is_read);
create index if not exists idx_admin_notifications_unique_key on public.admin_notifications(unique_key);

alter table public.admin_notifications enable row level security;

drop policy if exists "Allow public read admin notifications" on public.admin_notifications;
create policy "Allow public read admin notifications"
on public.admin_notifications
for select
to anon
using (true);

drop policy if exists "Allow public insert admin notifications" on public.admin_notifications;
create policy "Allow public insert admin notifications"
on public.admin_notifications
for insert
to anon
with check (true);

drop policy if exists "Allow public update admin notifications" on public.admin_notifications;
create policy "Allow public update admin notifications"
on public.admin_notifications
for update
to anon
using (true)
with check (true);
