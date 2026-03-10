-- 비회원(로그인 없이) 여행후기 작성 허용: member_id nullable
-- CASCADE로 생성된 FK 제거 후 NOT NULL 제거
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_member_id_fkey;
ALTER TABLE public.reviews ALTER COLUMN member_id DROP NOT NULL;
COMMENT ON COLUMN public.reviews.member_id IS '작성 회원 id. null이면 비회원 작성(author_name으로 표시)';
