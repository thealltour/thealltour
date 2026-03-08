-- PR20: 리뷰 Moderation 확장 (report_count, last_moderated_at, moderation_reason)
-- status는 기존 text 유지. 앱에서 under_review, flagged 사용 시 값만 저장.

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS last_moderated_at timestamptz;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS moderation_reason text;

CREATE INDEX IF NOT EXISTS idx_reviews_report_count ON public.reviews (report_count) WHERE report_count > 0;

COMMENT ON COLUMN public.reviews.report_count IS 'PR20: 신고 건수';
COMMENT ON COLUMN public.reviews.last_moderated_at IS 'PR20: 마지막 검토 처리 시각';
COMMENT ON COLUMN public.reviews.moderation_reason IS 'PR20: 숨김/검토 사유';
