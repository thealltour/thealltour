-- PR-6: 상세 랜딩 하위 탐색 카드(landing subnodes)
-- /destinations/[slug], /themes/[slug] 내에서 도시/소지역/세부테마/스타일/스팟 등 탐색 노드

create table if not exists public.landing_subnodes (
  id uuid primary key default gen_random_uuid(),
  parent_kind text not null
    check (parent_kind in ('destination', 'theme', 'recommended')),
  parent_slug text not null,
  node_type text not null
    check (node_type in ('city', 'subdestination', 'subtheme', 'style', 'spot', 'custom')),
  title text not null,
  slug text not null,
  description text,
  image_url text,
  badge_label text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  filter_payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_landing_subnodes_parent_slug unique (parent_kind, parent_slug, slug)
);

comment on table public.landing_subnodes is '상세 랜딩 하위 탐색 카드. parent(랜딩) + 노드별 필터로 /products?... 연결';
comment on column public.landing_subnodes.parent_kind is '상위 랜딩 종류: destination | theme | recommended';
comment on column public.landing_subnodes.parent_slug is '상위 랜딩 slug (예: japan, golf-travel)';
comment on column public.landing_subnodes.node_type is '노드 역할: city | subdestination | subtheme | style | spot | custom';
comment on column public.landing_subnodes.title is '카드에 표시할 제목';
comment on column public.landing_subnodes.slug is 'URL/필터용 식별자';
comment on column public.landing_subnodes.filter_payload is '카드 클릭 시 /products 쿼리 생성용 JSON. region, theme, q, tourType, sort 등';

create index if not exists idx_landing_subnodes_parent
  on public.landing_subnodes (parent_kind, parent_slug, sort_order)
  where is_active = true;

-- RLS: 공개 읽기는 허용, 쓰기는 서비스 역할만 (관리자 API에서 사용)
alter table public.landing_subnodes enable row level security;

create policy "landing_subnodes_select"
  on public.landing_subnodes for select
  using (true);

create policy "landing_subnodes_insert"
  on public.landing_subnodes for insert
  with check (true);

create policy "landing_subnodes_update"
  on public.landing_subnodes for update
  using (true);

create policy "landing_subnodes_delete"
  on public.landing_subnodes for delete
  using (true);
