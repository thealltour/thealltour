-- PR24: 리뷰 moderation 액션 이력
CREATE TABLE IF NOT EXISTS public.review_moderation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  from_status text,
  to_status text,
  reason text,
  actor_type text NOT NULL DEFAULT 'system',
  actor_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_moderation_history_review_id
ON public.review_moderation_history (review_id);
CREATE INDEX IF NOT EXISTS idx_review_moderation_history_created_at
ON public.review_moderation_history (created_at DESC);

COMMENT ON TABLE public.review_moderation_history IS 'PR24: 자동/수동 moderation 액션 로그';
