-- PR13: 리뷰 리마인더 테이블 (여행 완료 후 3일/7일 자동 후기 요청)
-- reminder_type: reminder_3d, reminder_7d
-- status: scheduled, sent, cancelled

create table if not exists public.review_reminders (
  id uuid primary key default gen_random_uuid(),
  eligibility_id uuid not null references public.review_eligibilities(id) on delete cascade,
  member_id text,
  reminder_type text not null check (reminder_type in ('reminder_3d', 'reminder_7d')),
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_review_reminders_schedule
  on public.review_reminders (scheduled_at);

create index if not exists idx_review_reminders_member
  on public.review_reminders (member_id) where member_id is not null;

create index if not exists idx_review_reminders_eligibility
  on public.review_reminders (eligibility_id);

create index if not exists idx_review_reminders_status
  on public.review_reminders (status);

comment on table public.review_reminders is 'PR13: 여행 완료 후 리뷰 리마인더. 3일/7일 발송 예정, 후기 제출 시 취소.';

alter table public.review_reminders enable row level security;

drop policy if exists "review_reminders_service_role" on public.review_reminders;
create policy "review_reminders_service_role" on public.review_reminders
  for all to service_role using (true) with check (true);
