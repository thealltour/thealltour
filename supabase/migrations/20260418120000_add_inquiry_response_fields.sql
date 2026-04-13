-- 응대 매뉴얼(체크리스트·단계·내부 메모) 저장용 컬럼
ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS response_checklist jsonb,
  ADD COLUMN IF NOT EXISTS response_note text,
  ADD COLUMN IF NOT EXISTS response_stage text,
  ADD COLUMN IF NOT EXISTS response_updated_at timestamptz;

COMMENT ON COLUMN public.inquiries.response_checklist IS '응대 필수 확인 체크리스트 (key -> boolean)';
COMMENT ON COLUMN public.inquiries.response_note IS '관리자 내부 메모';
COMMENT ON COLUMN public.inquiries.response_stage IS '응대 진행 단계 키';
COMMENT ON COLUMN public.inquiries.response_updated_at IS '응대 도구 필드 마지막 저장 시각';
