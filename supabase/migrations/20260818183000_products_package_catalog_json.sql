-- 하나투어 패키지 카탈로그 (예정 호텔 이름, 관광지, 선택관광, 상품 고유 참고사항)
alter table public.products
  add column if not exists package_catalog_json jsonb;

comment on column public.products.package_catalog_json is
  '하나투어 패키지 카탈로그. { hotels: [{name}], attractions: [{name, description, imageUrls}], optionalTours: [...], referenceNotes? }';
