-- =============================================================================
-- Step 3: 예약 증빙 기반 포인트 적립 요청
-- =============================================================================

create table if not exists public.point_earn_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete cascade,
  status text not null default 'REQUESTED' check (status in ('REQUESTED', 'APPROVED', 'REJECTED')),
  booking_ref text not null,
  departure_date date not null,
  payer_name text not null,
  memo text,
  contact_phone text,
  admin_memo text,
  reject_reason text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by_admin_id text
);

create unique index if not exists uq_point_earn_requests_booking_ref on public.point_earn_requests(booking_ref);
create index if not exists idx_point_earn_requests_user_status on public.point_earn_requests(user_id, status);
create index if not exists idx_point_earn_requests_status_requested on public.point_earn_requests(status, requested_at desc);

create table if not exists public.earn_request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.point_earn_requests(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_earn_request_attachments_request_id on public.earn_request_attachments(request_id);

alter table public.point_earn_requests enable row level security;
alter table public.earn_request_attachments enable row level security;

drop policy if exists "Allow anon point_earn_requests" on public.point_earn_requests;
create policy "Allow anon point_earn_requests"
on public.point_earn_requests
for all
to anon
using (true)
with check (true);

drop policy if exists "Allow anon earn_request_attachments" on public.earn_request_attachments;
create policy "Allow anon earn_request_attachments"
on public.earn_request_attachments
for all
to anon
using (true)
with check (true);
