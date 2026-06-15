-- SMS 수신 레코드에 회원 연결 FK 추가

ALTER TABLE public.inquiry_inbound_sms
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inquiry_inbound_sms_member_received
  ON public.inquiry_inbound_sms (member_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_inquiry_inbound_sms_unmatched_member
  ON public.inquiry_inbound_sms (match_status, received_at DESC)
  WHERE inquiry_id IS NULL AND member_id IS NULL;

COMMENT ON COLUMN public.inquiry_inbound_sms.member_id IS '전화번호 기반 회원 연결 (문의 없이 회원만 연결 가능)';
