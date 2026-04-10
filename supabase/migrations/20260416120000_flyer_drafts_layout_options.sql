-- 유인물 draft 레이아웃 옵션 (compact 모드 등, 공개/인쇄에 반영)

alter table public.flyer_drafts
  add column if not exists layout_options_json jsonb not null default '{}'::jsonb;

comment on column public.flyer_drafts.layout_options_json is 'compactMode, spacingMode, imageDensity 등 (FlyerLayoutOptions)';
