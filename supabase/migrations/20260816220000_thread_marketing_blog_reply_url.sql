-- Blog RSS Threads: nullable product_id + reply destination URL

alter table public.thread_marketing_posts
  alter column product_id drop not null;

alter table public.thread_marketing_posts
  add column if not exists reply_destination_url text;

alter table public.thread_marketing_posts
  add column if not exists source_type text not null default 'product';

alter table public.thread_marketing_posts
  add column if not exists source_url text;

comment on column public.thread_marketing_posts.reply_destination_url is
  'Auto-reply destination (absolute URL or site path). Used when set; otherwise product_id URL.';
comment on column public.thread_marketing_posts.source_type is
  'product | blog';
comment on column public.thread_marketing_posts.source_url is
  'Original content URL (e.g. Naver blog permalink) for blog posts';

update public.thread_marketing_posts
set source_type = 'product'
where source_type is null or btrim(source_type) = '';
