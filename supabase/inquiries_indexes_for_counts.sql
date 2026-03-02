-- inquiries 관리자 대시보드 count 쿼리 최적화용 인덱스
-- is_completed: 미완료 문의 필터
-- created_at: 날짜별 집계

create index if not exists idx_inquiries_is_completed_created_at
  on public.inquiries(is_completed, created_at desc);

create index if not exists idx_inquiries_created_at
  on public.inquiries(created_at desc);
