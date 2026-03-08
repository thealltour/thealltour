-- PR9: 리뷰 신고 테이블
-- 한 사용자당 동일 리뷰 1회만 신고 가능

CREATE TABLE IF NOT EXISTS public.review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  member_id text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  UNIQUE(review_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_review_reports_review_id
ON public.review_reports (review_id);

CREATE INDEX IF NOT EXISTS idx_review_reports_status
ON public.review_reports (status);

COMMENT ON TABLE public.review_reports IS '리뷰 신고. status: pending / resolved / dismissed';
