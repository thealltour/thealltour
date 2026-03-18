-- 문의 최초 유입 경로(first touch) 및 문의 제출 페이지 URL 저장
alter table public.inquiries add column if not exists first_touch jsonb;
alter table public.inquiries add column if not exists inquiry_page_url text;
