-- 모바일 골프 랜딩: 섹션별 스타일 설정 (폰트 크기, 강조색, 라운드박스)

alter table public.mobile_golf_ad_landings
  add column if not exists style_config jsonb not null default '{
    "benefit": { "fontSize": "md", "accentColor": "#0f172a", "roundBox": false },
    "trust": { "fontSize": "sm", "accentColor": "#334155", "roundBox": false }
  }'::jsonb;

comment on column public.mobile_golf_ad_landings.style_config is
  'Benefit/Trust 섹션별 fontSize(sm|md|lg), accentColor(#RRGGBB), roundBox(boolean)';
