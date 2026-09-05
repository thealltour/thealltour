-- Free Travel Planner MVP (PR-1): planner_sessions
-- Access: service_role / server API only (supabaseAdmin). No anon browser writes.

create table if not exists public.planner_sessions (
  id uuid primary key default gen_random_uuid(),
  anonymous_key text not null,
  member_id uuid null references public.members (id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'generated', 'saved')),
  input_json jsonb not null default '{}'::jsonb,
  plan_json jsonb null,
  source_product_id uuid null references public.products (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.planner_sessions is
  '자유여행 Planner 세션. anonymous_key로 비회원 식별, member_id는 서버 쿠키 세션에서만 연결.';

comment on column public.planner_sessions.anonymous_key is
  'Opaque client id (UUID). PII 금지.';

comment on column public.planner_sessions.source_product_id is
  '상품 상세에서 Planner로 진입한 경우 attribution용 products.id.';

create index if not exists planner_sessions_member_id_idx
  on public.planner_sessions (member_id);

create index if not exists planner_sessions_anonymous_key_idx
  on public.planner_sessions (anonymous_key);

create index if not exists planner_sessions_created_at_idx
  on public.planner_sessions (created_at desc);

alter table public.planner_sessions enable row level security;

drop policy if exists service_role_all_planner_sessions on public.planner_sessions;
create policy service_role_all_planner_sessions
  on public.planner_sessions
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.planner_sessions from anon, authenticated;
grant all on public.planner_sessions to service_role;
