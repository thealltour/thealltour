-- PR-E: 그룹별 상품 안내 공통 템플릿 (예약 유의 / 여행 유의 / 예약조건)
-- 기존 product_terms_templates 는 유지하며, 신규 테이블을 주 저장소로 사용. booking_notes 조회 시 레거시 폴백은 앱 레이어.

create table if not exists public.product_notice_templates (
  id uuid primary key default gen_random_uuid(),
  template_group text not null,
  type text not null,
  label text,
  content text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint product_notice_templates_group_chk check (
    template_group in ('booking_notes', 'travel_notes', 'booking_conditions')
  ),
  constraint product_notice_templates_type_nonempty check (char_length(trim(type)) > 0),
  constraint product_notice_templates_unique_group_type unique (template_group, type)
);

create index if not exists idx_product_notice_templates_group_sort
  on public.product_notice_templates (template_group, sort_order asc, type asc);

comment on table public.product_notice_templates is '상품 안내 공통 템플릿 (그룹+type 고유). 레거시 product_terms_templates는 폴백용 유지.';

alter table public.product_notice_templates enable row level security;

drop policy if exists "notice_templates_select_anon" on public.product_notice_templates;
create policy "notice_templates_select_anon"
  on public.product_notice_templates for select to anon using (true);

drop policy if exists "notice_templates_insert_anon" on public.product_notice_templates;
create policy "notice_templates_insert_anon"
  on public.product_notice_templates for insert to anon with check (true);

drop policy if exists "notice_templates_update_anon" on public.product_notice_templates;
create policy "notice_templates_update_anon"
  on public.product_notice_templates for update to anon using (true) with check (true);

drop policy if exists "notice_templates_delete_anon" on public.product_notice_templates;
create policy "notice_templates_delete_anon"
  on public.product_notice_templates for delete to anon using (true);

-- 1) 레거시 본문을 예약 유의 그룹으로 복사
insert into public.product_notice_templates (template_group, type, content, sort_order)
select
  'booking_notes',
  pt.type,
  coalesce(nullif(trim(pt.content), ''), ''),
  0
from public.product_terms_templates pt
on conflict (template_group, type) do update
set
  content = excluded.content,
  updated_at = now();

-- 2) 알려진 type 키(레거시 테이블에 없을 때 대비)
insert into public.product_notice_templates (template_group, type, content, sort_order)
select g.grp, t.typ, '', 0
from (
  values
    ('overseas_brokerage'),
    ('domestic_brokerage'),
    ('overseas_direct'),
    ('domestic_direct')
) as t(typ)
cross join (
  values
    ('booking_notes'),
    ('travel_notes'),
    ('booking_conditions')
) as g(grp)
on conflict (template_group, type) do nothing;

-- 3) travel_notes / booking_conditions 은 레거시가 비어 있으면 빈 행만 보장 (2번에서 이미 처리)
