-- SMS 센터 후속: 번호 단독 발송, 템플릿, 대량 발송, Realtime

-- 1) inquiry_message_logs.inquiry_id nullable (문의 없이 발송)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inquiry_message_logs' AND column_name = 'inquiry_id'
  ) THEN
    ALTER TABLE public.inquiry_message_logs ALTER COLUMN inquiry_id DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inquiry_message_logs_recipient_created
  ON public.inquiry_message_logs (recipient_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inquiry_message_logs_orphan_recipient
  ON public.inquiry_message_logs (recipient_phone, created_at DESC)
  WHERE inquiry_id IS NULL;

-- 2) SMS 템플릿
CREATE TABLE IF NOT EXISTS public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  category text NULL DEFAULT 'general',
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_templates_active_sort
  ON public.sms_templates (is_active, sort_order, created_at DESC);

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read sms_templates" ON public.sms_templates;
CREATE POLICY "Allow public read sms_templates"
  ON public.sms_templates FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow public insert sms_templates" ON public.sms_templates;
CREATE POLICY "Allow public insert sms_templates"
  ON public.sms_templates FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update sms_templates" ON public.sms_templates;
CREATE POLICY "Allow public update sms_templates"
  ON public.sms_templates FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete sms_templates" ON public.sms_templates;
CREATE POLICY "Allow public delete sms_templates"
  ON public.sms_templates FOR DELETE TO anon USING (true);

-- 3) 대량 발송 job
CREATE TABLE IF NOT EXISTS public.sms_bulk_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  template_id uuid NULL REFERENCES public.sms_templates (id) ON DELETE SET NULL,
  source_type text NOT NULL,
  source_filter jsonb NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  total_count int NOT NULL DEFAULT 0,
  success_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  created_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  CONSTRAINT sms_bulk_jobs_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  CONSTRAINT sms_bulk_jobs_source_type_check
    CHECK (source_type IN ('manual', 'inquiries', 'members'))
);

CREATE TABLE IF NOT EXISTS public.sms_bulk_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.sms_bulk_jobs (id) ON DELETE CASCADE,
  recipient_phone text NOT NULL,
  inquiry_id text NULL,
  member_id text NULL,
  recipient_name text NULL,
  status text NOT NULL DEFAULT 'pending',
  message_log_id uuid NULL,
  failure_reason text NULL,
  processed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sms_bulk_job_items_status_check
    CHECK (status IN ('pending', 'success', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_sms_bulk_jobs_status_created
  ON public.sms_bulk_jobs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_bulk_job_items_job_status
  ON public.sms_bulk_job_items (job_id, status);

ALTER TABLE public.sms_bulk_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_bulk_job_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read sms_bulk_jobs" ON public.sms_bulk_jobs;
CREATE POLICY "Allow public read sms_bulk_jobs" ON public.sms_bulk_jobs FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow public insert sms_bulk_jobs" ON public.sms_bulk_jobs;
CREATE POLICY "Allow public insert sms_bulk_jobs" ON public.sms_bulk_jobs FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update sms_bulk_jobs" ON public.sms_bulk_jobs;
CREATE POLICY "Allow public update sms_bulk_jobs" ON public.sms_bulk_jobs FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read sms_bulk_job_items" ON public.sms_bulk_job_items;
CREATE POLICY "Allow public read sms_bulk_job_items" ON public.sms_bulk_job_items FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow public insert sms_bulk_job_items" ON public.sms_bulk_job_items;
CREATE POLICY "Allow public insert sms_bulk_job_items" ON public.sms_bulk_job_items FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update sms_bulk_job_items" ON public.sms_bulk_job_items;
CREATE POLICY "Allow public update sms_bulk_job_items" ON public.sms_bulk_job_items FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- 4) Realtime publication (테이블 존재 시)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inquiry_inbound_sms') THEN
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiry_inbound_sms;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inquiry_message_logs') THEN
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiry_message_logs;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_notifications') THEN
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END IF;
END $$;
