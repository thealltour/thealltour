-- Guides taxonomy links: destination_id, theme_id (FK to product_taxonomies).
-- 최소 단위: 가이드를 destination/theme 랜딩과 연결하기 위한 2개 축만 추가.

ALTER TABLE public.guides
  ADD COLUMN IF NOT EXISTS destination_id uuid NULL REFERENCES public.product_taxonomies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS theme_id uuid NULL REFERENCES public.product_taxonomies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guides_destination_id ON public.guides(destination_id) WHERE destination_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guides_theme_id ON public.guides(theme_id) WHERE theme_id IS NOT NULL;

COMMENT ON COLUMN public.guides.destination_id IS '연결된 지역 taxonomy (product_taxonomies.id, taxonomy_type=destination). 랜딩 노출용.';
COMMENT ON COLUMN public.guides.theme_id IS '연결된 테마 taxonomy (product_taxonomies.id, taxonomy_type=theme). 랜딩 노출용.';
