-- PR-G: 환불/취소 규정 전용 컬럼 + product_notice_templates 그룹 확장

alter table public.products
  add column if not exists refund_policy text,
  add column if not exists refund_policy_template_type text;

comment on column public.products.refund_policy is '환불 및 취소 규정';
comment on column public.products.refund_policy_template_type is '환불 규정 템플릿 타입';

-- 원격/로컬에 따라 이름이 다를 수 있음: _chk(마이그레이션 명시) vs _check(PG/대시보드 기본)
alter table public.product_notice_templates drop constraint if exists product_notice_templates_group_chk;
alter table public.product_notice_templates drop constraint if exists product_notice_templates_group_check;

alter table public.product_notice_templates add constraint product_notice_templates_group_chk check (
  template_group in (
    'booking_notes',
    'travel_notes',
    'booking_conditions',
    'refund_policy',
    'legacy'
  )
);

insert into public.product_notice_templates (template_group, type, content, sort_order)
select 'refund_policy', t.typ, '', 0
from (
  values
    ('overseas_brokerage'),
    ('domestic_brokerage'),
    ('overseas_direct'),
    ('domestic_direct')
) as t(typ)
on conflict (template_group, type) do nothing;
