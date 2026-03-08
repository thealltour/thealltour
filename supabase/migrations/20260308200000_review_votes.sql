-- PR8: 리뷰 도움됨(Helpful) 투표용 테이블
-- 한 사용자당 리뷰당 1회 투표 가능 (toggle)

CREATE TABLE IF NOT EXISTS public.review_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  member_id text NOT NULL,
  vote_type text NOT NULL DEFAULT 'helpful',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(review_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_review_votes_review_id
ON public.review_votes (review_id);

CREATE INDEX IF NOT EXISTS idx_review_votes_member_id
ON public.review_votes (member_id);

COMMENT ON TABLE public.review_votes IS '리뷰 도움됨(helpful) 투표. (review_id, member_id) 당 1건.';
