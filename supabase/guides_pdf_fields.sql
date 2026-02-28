-- guides 테이블에 PDF 필드 추가
-- guide_pdf_url: PDF 파일 URL
-- guide_thumbnail_url: PDF 1페이지 썸네일 이미지 URL
alter table public.guides add column if not exists guide_pdf_url text;
alter table public.guides add column if not exists guide_thumbnail_url text;
