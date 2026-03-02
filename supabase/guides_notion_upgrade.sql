-- 여행가이드(Notion 연동) 확장 컬럼

alter table public.guides
  add column if not exists slug text unique,
  add column if not exists notion_page_id text unique,
  add column if not exists notion_url text,
  add column if not exists title_override text,
  add column if not exists cover_image_url text,
  add column if not exists tags text[],
  add column if not exists category text,
  add column if not exists published_at timestamptz,
  add column if not exists notion_last_edited_time timestamptz,
  add column if not exists last_synced_at timestamptz;

create index if not exists idx_guides_slug on public.guides(slug);
create index if not exists idx_guides_notion_page_id on public.guides(notion_page_id);

