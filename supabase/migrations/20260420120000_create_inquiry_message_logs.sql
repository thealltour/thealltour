-- 문의별 SMS(알리고 relay) 발송 로그

-- inquiries.id 타입(uuid | bigint)에 맞춰 inquiry_id FK 정합성 유지
DO $$
DECLARE
  id_type text;
  tbl_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'inquiry_message_logs'
  ) INTO tbl_exists;

  IF tbl_exists THEN
    NULL;
  ELSE
    SELECT c.data_type INTO id_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'inquiries'
      AND c.column_name = 'id';

    IF id_type = 'uuid' THEN
      CREATE TABLE public.inquiry_message_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        inquiry_id uuid NOT NULL REFERENCES public.inquiries (id) ON DELETE CASCADE,
        channel text NOT NULL DEFAULT 'sms',
        recipient_phone text NOT NULL,
        message text NOT NULL,
        provider text NOT NULL DEFAULT 'aligo_relay',
        send_status text NOT NULL,
        provider_response jsonb NULL,
        failure_reason text NULL,
        actor_name text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT inquiry_message_logs_send_status_check
          CHECK (send_status IN ('success', 'failed'))
      );
    ELSIF id_type = 'bigint' THEN
      CREATE TABLE public.inquiry_message_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        inquiry_id bigint NOT NULL REFERENCES public.inquiries (id) ON DELETE CASCADE,
        channel text NOT NULL DEFAULT 'sms',
        recipient_phone text NOT NULL,
        message text NOT NULL,
        provider text NOT NULL DEFAULT 'aligo_relay',
        send_status text NOT NULL,
        provider_response jsonb NULL,
        failure_reason text NULL,
        actor_name text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT inquiry_message_logs_send_status_check
          CHECK (send_status IN ('success', 'failed'))
      );
    ELSE
      RAISE EXCEPTION 'Unsupported public.inquiries.id type for inquiry_message_logs: %', id_type;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inquiry_message_logs_inquiry_created_at
  ON public.inquiry_message_logs (inquiry_id, created_at DESC);

COMMENT ON TABLE public.inquiry_message_logs IS '문의 관련 SMS 발송 이력(알리고 relay)';

ALTER TABLE public.inquiry_message_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read inquiry_message_logs" ON public.inquiry_message_logs;
CREATE POLICY "Allow public read inquiry_message_logs"
  ON public.inquiry_message_logs
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow public insert inquiry_message_logs" ON public.inquiry_message_logs;
CREATE POLICY "Allow public insert inquiry_message_logs"
  ON public.inquiry_message_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);
