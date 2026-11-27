-- Non-destructive: add quote_snapshot for general/product/corporate inquiry intake.
-- Does not modify existing rows, RLS, or grants.
alter table public.inquiries
  add column if not exists quote_snapshot jsonb;
