/**
 * 서버 전용 Supabase Admin 클라이언트 (service_role).
 * RLS를 우회하므로 API 라우트·서버 컴포넌트에서만 사용하세요.
 * SUPABASE_SERVICE_ROLE_KEY는 절대 NEXT_PUBLIC_ 접두어 사용 금지.
 */
import "server-only";

import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
