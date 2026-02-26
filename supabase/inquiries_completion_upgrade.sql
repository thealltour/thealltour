alter table public.inquiries
add column if not exists is_completed boolean not null default false;

create index if not exists idx_inquiries_is_completed on public.inquiries(is_completed);
