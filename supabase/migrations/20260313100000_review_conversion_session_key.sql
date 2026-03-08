-- PR27: 리뷰 전환 attribution용 session_key 추가.
-- 전환 이벤트와 리뷰 상호작용을 세션 단위로 연결하기 위함.

alter table if exists public.review_experiment_events
  add column if not exists session_key text;

create index if not exists idx_review_experiment_events_session_key
  on public.review_experiment_events(session_key)
  where session_key is not null;

comment on column public.review_experiment_events.session_key is 'PR27: attribution 그룹핑용 세션 식별자';
