alter table public.members
  add column if not exists points integer not null default 0;

comment on column public.members.points is '보유 포인트 (관리자 수동 관리)';

