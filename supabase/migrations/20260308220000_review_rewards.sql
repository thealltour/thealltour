-- PR10: 리뷰 보상 테이블 (인증 후기 작성 시 포인트 지급, 리뷰당 1회)
CREATE TABLE IF NOT EXISTS public.review_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  member_id text NOT NULL,
  reward_type text NOT NULL DEFAULT 'review_write',
  points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(review_id)
);

CREATE INDEX IF NOT EXISTS idx_review_rewards_review_id
ON public.review_rewards (review_id);

CREATE INDEX IF NOT EXISTS idx_review_rewards_member_id
ON public.review_rewards (member_id);

COMMENT ON TABLE public.review_rewards IS '리뷰 작성 보상. review_id당 1회 지급. reward_type: review_write 등';
