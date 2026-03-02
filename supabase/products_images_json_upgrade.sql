-- 상품 다중 이미지 저장용 컬럼
-- images_json: ["https://...", "https://..."] (첫 번째가 대표 이미지)

alter table public.products
add column if not exists images_json jsonb;

-- 기존 데이터는 대표 이미지(image_url)를 images_json[0]로 마이그레이션
update public.products
set images_json = jsonb_build_array(image_url)
where (images_json is null or images_json = '[]'::jsonb)
  and image_url is not null
  and btrim(image_url) <> '';

comment on column public.products.images_json is '상품 다중 이미지 URL 배열. 첫 번째 요소를 대표 이미지로 사용';
