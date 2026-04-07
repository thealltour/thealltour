-- PR-A: 계절·주말·성수기 구간가 (jsonb). 기존 price 컬럼은 유지.
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS seasonal_price_bands jsonb;

COMMENT ON COLUMN public.products.seasonal_price_bands IS
  'Optional tiered prices in KRW: { "offSeason"?, "weekend"?, "peakSeason"? }. Legacy rows: null.';
