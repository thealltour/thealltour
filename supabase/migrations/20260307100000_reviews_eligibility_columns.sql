-- reviews 테이블에 eligibility 기반 후기 제출을 위한 컬럼 추가
-- PR3 보완: eligibility 기반 후기 제출 완료 처리 연결

-- ============================================
-- 1. 컬럼 추가 (ADD COLUMN IF NOT EXISTS 사용)
-- ============================================

-- rating 컬럼 (별점)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS rating integer;

-- image_url 컬럼 (단일 이미지, 레거시)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS image_url text;

-- image_urls 컬럼 (복수 이미지)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

-- eligibility_id 컬럼 (후기 작성 자격 연결)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS eligibility_id uuid;

-- booking_id 컬럼 (여행 예약 연결)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS booking_id uuid;

-- customer_profile_id 컬럼 (고객 프로필 연결)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS customer_profile_id uuid;

-- status 컬럼 (draft, submitted, hidden)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted';

-- ============================================
-- 2. FK 제약조건 추가 (이미 있으면 스킵)
-- ============================================

DO $$
BEGIN
  -- eligibility_id FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reviews_eligibility_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'reviews'
  ) THEN
    ALTER TABLE public.reviews
    ADD CONSTRAINT reviews_eligibility_id_fkey
    FOREIGN KEY (eligibility_id) REFERENCES public.review_eligibilities(id) ON DELETE SET NULL;
  END IF;

  -- booking_id FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reviews_booking_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'reviews'
  ) THEN
    ALTER TABLE public.reviews
    ADD CONSTRAINT reviews_booking_id_fkey
    FOREIGN KEY (booking_id) REFERENCES public.travel_bookings(id) ON DELETE SET NULL;
  END IF;

  -- customer_profile_id FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reviews_customer_profile_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'reviews'
  ) THEN
    ALTER TABLE public.reviews
    ADD CONSTRAINT reviews_customer_profile_id_fkey
    FOREIGN KEY (customer_profile_id) REFERENCES public.customer_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- 3. 인덱스 생성
-- ============================================

-- 하나의 eligibility당 후기 1개만 허용하는 unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_eligibility_unique
ON public.reviews (eligibility_id)
WHERE eligibility_id IS NOT NULL;

-- eligibility_id로 빠른 조회
CREATE INDEX IF NOT EXISTS idx_reviews_eligibility_id
ON public.reviews (eligibility_id)
WHERE eligibility_id IS NOT NULL;

-- status로 필터링
CREATE INDEX IF NOT EXISTS idx_reviews_status
ON public.reviews (status);

-- ============================================
-- 4. 확인 쿼리 (실행 후 주석 해제하여 확인 가능)
-- ============================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'reviews'
-- ORDER BY ordinal_position;
