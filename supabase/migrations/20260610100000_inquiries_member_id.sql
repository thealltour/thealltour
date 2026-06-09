-- inquiries.member_id: 관리자가 문의를 특정 회원에게 배정 (표시·필터용)
-- 리뷰 권한 source of truth는 customer_account_links + review_eligibilities.claimed_by_member_id

alter table public.inquiries
  add column if not exists member_id uuid references public.members(id) on delete set null;

create index if not exists idx_inquiries_member_id
  on public.inquiries (member_id)
  where member_id is not null;

comment on column public.inquiries.member_id is '배정된 회원 id. customer_account_links와 함께 문의-회원 연결에 사용.';
