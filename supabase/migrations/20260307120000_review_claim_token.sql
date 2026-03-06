-- review_eligibilities에 Claim Token 컬럼 추가
-- PR4: 후기 Claim Token 시스템

-- ============================================
-- 1. Claim Token 컬럼 추가
-- ============================================

-- claim_token: 후기 권한 연결용 토큰 (uuid 형식)
ALTER TABLE public.review_eligibilities
ADD COLUMN IF NOT EXISTS claim_token text;

-- claim_token_expires_at: 토큰 만료시간 (여행 완료 후 90일 권장)
ALTER TABLE public.review_eligibilities
ADD COLUMN IF NOT EXISTS claim_token_expires_at timestamptz;

-- ============================================
-- 2. 인덱스 추가
-- ============================================

-- claim_token unique index (token 조회 + 중복 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_eligibilities_claim_token
ON public.review_eligibilities (claim_token)
WHERE claim_token IS NOT NULL;

-- ============================================
-- 3. 확인 쿼리 (실행 후 주석 해제하여 확인 가능)
-- ============================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'review_eligibilities'
-- ORDER BY ordinal_position;
