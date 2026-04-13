-- PR4: 담당자·우선순위·팔로업·활동 로그

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS assignee_id uuid,
  ADD COLUMN IF NOT EXISTS assignee_name text,
  ADD COLUMN IF NOT EXISTS lead_priority text,
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

COMMENT ON COLUMN public.inquiries.assignee_id IS '담당자 식별(uuid, 선택)';
COMMENT ON COLUMN public.inquiries.assignee_name IS '담당자 표시명';
COMMENT ON COLUMN public.inquiries.lead_priority IS '리드 우선순위: high|medium|low';
COMMENT ON COLUMN public.inquiries.next_action IS '다음 액션 메모';
COMMENT ON COLUMN public.inquiries.follow_up_at IS '다음 팔로업 예정 시각';
COMMENT ON COLUMN public.inquiries.last_contacted_at IS '고객에게 마지막 응대 시각';
COMMENT ON COLUMN public.inquiries.last_activity_at IS '문의에 마지막 운영 활동 시각';

ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_lead_priority_check;
ALTER TABLE public.inquiries
  ADD CONSTRAINT inquiries_lead_priority_check
  CHECK (lead_priority IS NULL OR lead_priority IN ('high', 'medium', 'low'));

CREATE TABLE IF NOT EXISTS public.inquiry_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES public.inquiries (id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  actor_id uuid NULL,
  actor_name text NULL,
  summary text NOT NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_activity_logs_inquiry_created_at
  ON public.inquiry_activity_logs (inquiry_id, created_at DESC);

COMMENT ON TABLE public.inquiry_activity_logs IS '문의 운영 활동 히스토리';

ALTER TABLE public.inquiry_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read inquiry_activity_logs" ON public.inquiry_activity_logs;
CREATE POLICY "Allow public read inquiry_activity_logs"
  ON public.inquiry_activity_logs
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow public insert inquiry_activity_logs" ON public.inquiry_activity_logs;
CREATE POLICY "Allow public insert inquiry_activity_logs"
  ON public.inquiry_activity_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);
