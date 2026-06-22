-- 관리자 실시간 채팅: 방·멤버·메시지

CREATE TABLE IF NOT EXISTS public.admin_chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('direct', 'group')),
  name text NULL,
  direct_key text NULL,
  created_by_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_chat_rooms_direct_key_unique UNIQUE (direct_key),
  CONSTRAINT admin_chat_rooms_direct_name_check CHECK (
    (type = 'direct' AND direct_key IS NOT NULL)
    OR (type = 'group' AND name IS NOT NULL AND length(trim(name)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_admin_chat_rooms_updated_at
  ON public.admin_chat_rooms (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_chat_room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.admin_chat_rooms (id) ON DELETE CASCADE,
  admin_user_key text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NULL,
  CONSTRAINT admin_chat_room_members_room_user_unique UNIQUE (room_id, admin_user_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_chat_room_members_user
  ON public.admin_chat_room_members (admin_user_key, joined_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_chat_room_members_room
  ON public.admin_chat_room_members (room_id);

CREATE TABLE IF NOT EXISTS public.admin_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.admin_chat_rooms (id) ON DELETE CASCADE,
  sender_key text NOT NULL,
  sender_display_name text NOT NULL,
  sender_role_label text NOT NULL,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_chat_messages_room_created
  ON public.admin_chat_messages (room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_chat_messages_created_at
  ON public.admin_chat_messages (created_at);

-- RLS: service_role 전용
ALTER TABLE public.admin_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_chat_messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'admin_chat_rooms',
    'admin_chat_room_members',
    'admin_chat_messages'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'service_role_all_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      'service_role_all_' || t,
      t
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END;
$$;

-- Realtime publication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_chat_messages'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_chat_messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;
