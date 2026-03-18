-- 문의 최초유입 자동 분류 필드 (acquisition_*)
alter table public.inquiries add column if not exists acquisition_channel text;
alter table public.inquiries add column if not exists acquisition_source_label text;
alter table public.inquiries add column if not exists acquisition_medium text;
alter table public.inquiries add column if not exists acquisition_summary text;
alter table public.inquiries add column if not exists first_landing_path text;
