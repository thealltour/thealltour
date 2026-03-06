-- reviews 테이블에 draft/여행 후기형 필드 추가
-- PR5: 후기 작성 UX 고도화 + Draft/임시저장 + 이미지 업로드 강화

-- ============================================
-- 1. 새 컬럼 추가
-- ============================================

-- updated_at 컬럼 (수정 시간)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- summary 컬럼 (한줄 요약)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS summary text;

-- content_good 컬럼 (좋았던 점)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS content_good text;

-- content_bad 컬럼 (아쉬웠던 점)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS content_bad text;

-- content_tip 컬럼 (여행 팁)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS content_tip text;

-- rating_schedule 컬럼 (일정 만족도)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS rating_schedule integer;

-- rating_stay 컬럼 (숙소 만족도)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS rating_stay integer;

-- rating_guide 컬럼 (가이드 만족도)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS rating_guide integer;

-- rating_food 컬럼 (식사 만족도)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS rating_food integer;

-- ============================================
-- 2. 인덱스 추가
-- ============================================

-- updated_at 인덱스 (최근 수정 순 정렬용)
CREATE INDEX IF NOT EXISTS idx_reviews_updated_at
ON public.reviews (updated_at DESC);

-- member_id + status 복합 인덱스 (마이페이지 조회용)
CREATE INDEX IF NOT EXISTS idx_reviews_member_status
ON public.reviews (member_id, status);

-- ============================================
-- 3. 기존 eligibility unique index 정책 확인
-- ============================================
-- 기존: idx_reviews_eligibility_unique (eligibility_id) WHERE eligibility_id IS NOT NULL
-- → 동일 eligibility에 review 1개만 허용
-- → draft → submitted 전환 시 같은 레코드 사용 (문제 없음)

-- ============================================
-- 4. 확인 쿼리
-- ============================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'reviews'
-- ORDER BY ordinal_position;
