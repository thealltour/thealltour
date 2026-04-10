-- consultation_status에 보류(on_hold) 추가 — 운영 큐에서 제외하되 DB에는 유지
-- (20260407120000은 products_seasonal_price_bands와 분리해 적용 순서를 고정)
alter table public.inquiries drop constraint if exists inquiries_consultation_status_check;

alter table public.inquiries
  add constraint inquiries_consultation_status_check
  check (consultation_status in ('new', 'contacted', 'closed', 'on_hold'));

comment on column public.inquiries.consultation_status is
  '상담 진행 상태: new(신규), contacted(상담중), closed(종료), on_hold(보류·큐 제외)';
