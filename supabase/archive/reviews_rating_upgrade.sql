alter table public.reviews
  add column if not exists rating integer;

comment on column public.reviews.rating is '여행후기 별점 (1~5)';
