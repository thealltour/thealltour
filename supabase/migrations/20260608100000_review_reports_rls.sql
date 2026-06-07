-- review_reports: 관리자 API(service_role) 전용 접근. anon/authenticated 정책 없음.

alter table public.review_reports enable row level security;

-- 기존 anon 정책이 있으면 제거
drop policy if exists "review_reports_all_anon" on public.review_reports;
drop policy if exists "review_reports_select_anon" on public.review_reports;
drop policy if exists "review_reports_insert_anon" on public.review_reports;

comment on table public.review_reports is '리뷰 신고. status: pending / resolved / dismissed. API(service_role) 관리 전용.';
