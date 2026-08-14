import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const THREAD_MARKETING_TOKEN_ROW_ID = "default";

export async function getStoredThreadsAccessToken(): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("thread_marketing_tokens")
    .select("access_token")
    .eq("id", THREAD_MARKETING_TOKEN_ROW_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`thread_marketing_tokens 조회 실패: ${error.message}`);
  }
  const token = typeof data?.access_token === "string" ? data.access_token.trim() : "";
  return token || null;
}

export async function saveThreadsAccessToken(input: {
  accessToken: string;
  expiresAt: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("thread_marketing_tokens").upsert(
    {
      id: THREAD_MARKETING_TOKEN_ROW_ID,
      access_token: input.accessToken,
      expires_at: input.expiresAt,
      refreshed_at: now,
      updated_at: now,
    },
    { onConflict: "id" },
  );
  if (error) {
    throw new Error(`thread_marketing_tokens 저장 실패: ${error.message}`);
  }
}

export async function insertThreadMarketingLog(input: {
  event: string;
  status: "ok" | "error";
  message?: string;
  meta?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("thread_marketing_logs").insert({
    event: input.event,
    status: input.status,
    message: input.message ?? null,
    meta: input.meta ?? null,
  });
  if (error) {
    throw new Error(`thread_marketing_logs 저장 실패: ${error.message}`);
  }
}
