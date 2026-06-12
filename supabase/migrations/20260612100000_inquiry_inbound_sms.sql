-- textbee.dev 수신 SMS (문의 CS 연동)

DO $$
DECLARE
  id_type text;
  tbl_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'inquiry_inbound_sms'
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
      CREATE TABLE public.inquiry_inbound_sms (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        provider text NOT NULL DEFAULT 'textbee',
        provider_message_id text NOT NULL,
        sender_phone text NOT NULL,
        message text NOT NULL,
        received_at timestamptz NOT NULL,
        inquiry_id uuid NULL REFERENCES public.inquiries (id) ON DELETE SET NULL,
        match_status text NOT NULL,
        match_reason text NULL,
        read_at timestamptz NULL,
        raw_payload jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT inquiry_inbound_sms_provider_message_id_key UNIQUE (provider_message_id),
        CONSTRAINT inquiry_inbound_sms_match_status_check
          CHECK (match_status IN ('matched', 'unmatched', 'manual_linked'))
      );
    ELSIF id_type = 'bigint' THEN
      CREATE TABLE public.inquiry_inbound_sms (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        provider text NOT NULL DEFAULT 'textbee',
        provider_message_id text NOT NULL,
        sender_phone text NOT NULL,
        message text NOT NULL,
        received_at timestamptz NOT NULL,
        inquiry_id bigint NULL REFERENCES public.inquiries (id) ON DELETE SET NULL,
        match_status text NOT NULL,
        match_reason text NULL,
        read_at timestamptz NULL,
        raw_payload jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT inquiry_inbound_sms_provider_message_id_key UNIQUE (provider_message_id),
        CONSTRAINT inquiry_inbound_sms_match_status_check
          CHECK (match_status IN ('matched', 'unmatched', 'manual_linked'))
      );
    ELSE
      RAISE EXCEPTION 'Unsupported public.inquiries.id type for inquiry_inbound_sms: %', id_type;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inquiry_inbound_sms_inquiry_received
  ON public.inquiry_inbound_sms (inquiry_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_inquiry_inbound_sms_sender_received
  ON public.inquiry_inbound_sms (sender_phone, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_inquiry_inbound_sms_unmatched_received
  ON public.inquiry_inbound_sms (match_status, received_at DESC)
  WHERE match_status = 'unmatched';

CREATE INDEX IF NOT EXISTS idx_inquiry_inbound_sms_unread_inquiry
  ON public.inquiry_inbound_sms (inquiry_id)
  WHERE read_at IS NULL AND inquiry_id IS NOT NULL;

COMMENT ON TABLE public.inquiry_inbound_sms IS 'textbee 등 외부 게이트웨이 수신 SMS (발송은 inquiry_message_logs)';

ALTER TABLE public.inquiry_inbound_sms ENABLE ROW LEVEL SECURITY;
