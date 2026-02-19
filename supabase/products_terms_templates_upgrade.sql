create table if not exists public.product_terms_templates (
  type text primary key,
  content text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.product_terms_templates (type, content)
values
  ('overseas_brokerage', '해외중개 약관 템플릿을 입력해 주세요.'),
  ('domestic_brokerage', '국내중개 약관 템플릿을 입력해 주세요.'),
  ('overseas_direct', '해외직접 약관 템플릿을 입력해 주세요.'),
  ('domestic_direct', '국내직접 약관 템플릿을 입력해 주세요.')
on conflict (type) do nothing;

alter table public.products
add column if not exists terms_template_type text;

comment on table public.product_terms_templates is '상품 약관/참조사항 공통 템플릿';
comment on column public.product_terms_templates.type is '템플릿 구분 키';
comment on column public.product_terms_templates.content is '템플릿 본문';
comment on column public.products.terms_template_type is '상품 약관 템플릿 키';
