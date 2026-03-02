-- [STEP 2] overview_json jsonb 1컬럼 스키마
-- 기존 overview_cover_url + overview_json → overview_json 단일 컬럼으로 통합
-- overview_json: { enabled, title?, summaryCards, coverImageUrl?, chart?, timeline? }

-- overview_json 컬럼이 이미 존재하면 변경 없음
alter table public.products add column if not exists overview_json jsonb;

comment on column public.products.overview_json is '오버뷰 jsonb: { enabled, title?, summaryCards: [{kind,label,value}], coverImageUrl?, chart?: {enabled,items:[{label,percent}]}, timeline?: {enabled,days:[{day,dateText?,headline?,bullets}]} }';
