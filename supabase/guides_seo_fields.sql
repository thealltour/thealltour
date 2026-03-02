-- 여행가이드 SEO 필드 추가

alter table public.guides
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists focus_keyword text;

comment on column public.guides.seo_title is 'SEO용 제목 (비우면 title_override/title 사용)';
comment on column public.guides.seo_description is 'meta description (비우면 노션 첫 문단 160자 자동)';
comment on column public.guides.focus_keyword is '포커스 키워드 (운영/전략용)';
