-- 비파괴 backfill: overview_duration ← duration, category ← taxonomy name
-- 실행 전 아래 SELECT로 대상 행 수를 확인하세요.

-- 1) overview_duration backfill 대상
SELECT count(*) AS overview_duration_backfill_count
FROM public.products
WHERE (overview_duration IS NULL OR trim(overview_duration) = '')
  AND duration IS NOT NULL
  AND trim(duration) <> '';

-- 2) category ← taxonomy name sync 대상
SELECT count(*) AS category_taxonomy_sync_count
FROM public.products p
JOIN public.product_taxonomies t ON p.destination_id = t.id
WHERE t.name IS NOT NULL
  AND trim(t.name) <> ''
  AND (p.category IS NULL OR trim(p.category) = '' OR p.category <> t.name);

-- === UPDATE (staging 검증 후 실행) ===

UPDATE public.products
SET overview_duration = duration
WHERE (overview_duration IS NULL OR trim(overview_duration) = '')
  AND duration IS NOT NULL
  AND trim(duration) <> '';

UPDATE public.products p
SET category = t.name
FROM public.product_taxonomies t
WHERE p.destination_id = t.id
  AND t.name IS NOT NULL
  AND trim(t.name) <> ''
  AND (p.category IS NULL OR trim(p.category) = '' OR p.category <> t.name);
