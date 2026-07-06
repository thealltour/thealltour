-- 모바일 골프 랜딩: TipTap ProseMirror JSON 본문 (인라인 스타일 + 상품 레일 블록)

alter table public.mobile_golf_ad_landings
  add column if not exists body_doc jsonb not null default '{"type":"doc","content":[]}'::jsonb;

comment on column public.mobile_golf_ad_landings.body_doc is
  'TipTap JSON 본문. paragraph/text marks(fontSize,textColor,highlightBox) + golfProductRail node';
