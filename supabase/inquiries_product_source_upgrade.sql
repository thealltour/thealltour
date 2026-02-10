alter table public.inquiries
add column if not exists product_id text;

alter table public.inquiries
add column if not exists product_title text;

alter table public.inquiries
add column if not exists source_path text;

create index if not exists idx_inquiries_product_id on public.inquiries(product_id);
create index if not exists idx_inquiries_product_title on public.inquiries(product_title);
