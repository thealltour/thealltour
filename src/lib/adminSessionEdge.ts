import type { AdminSessionPayload } from "@/lib/adminSession";
import { verifyAdminSessionJwt } from "@/lib/adminSession";
import {
  ADMIN_SESSION_TOUCH_THROTTLE_MS,
  getAdminSessionInactivityMs,
} from "@/lib/adminSessionPolicy";

type AdminSessionDbRow = {
  id: string;
  revoked_at: string | null;
  last_seen_at: string;
};

const touchThrottle = new Map<string, number>();

function getSupabaseRestConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

function isSessionRowActive(row: AdminSessionDbRow): boolean {
  if (row.revoked_at) return false;
  const lastSeen = new Date(row.last_seen_at).getTime();
  if (!Number.isFinite(lastSeen)) return false;
  return Date.now() - lastSeen <= getAdminSessionInactivityMs();
}

async function fetchAdminSessionRow(sessionId: string): Promise<AdminSessionDbRow | null> {
  const config = getSupabaseRestConfig();
  if (!config) return null;

  const res = await fetch(
    `${config.url}/rest/v1/admin_sessions?id=eq.${encodeURIComponent(sessionId)}&select=id,revoked_at,last_seen_at`,
    {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
      },
      cache: "no-store",
    },
  );

  if (!res.ok) return null;
  const rows = (await res.json()) as AdminSessionDbRow[];
  return rows[0] ?? null;
}

async function touchAdminSessionEdge(sessionId: string): Promise<void> {
  const last = touchThrottle.get(sessionId) ?? 0;
  if (Date.now() - last < ADMIN_SESSION_TOUCH_THROTTLE_MS) return;
  touchThrottle.set(sessionId, Date.now());

  const config = getSupabaseRestConfig();
  if (!config) return;

  await fetch(
    `${config.url}/rest/v1/admin_sessions?id=eq.${encodeURIComponent(sessionId)}&revoked_at=is.null`,
    {
      method: "PATCH",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
      cache: "no-store",
    },
  ).catch(() => {
    // touch 실패는 인증 자체를 막지 않음
  });
}

/** Edge middleware용: JWT + DB 세션 검증 */
export async function resolveAdminSessionFromRequestToken(
  token: string | undefined | null,
  options?: { touch?: boolean },
): Promise<AdminSessionPayload | null> {
  const jwtPayload = await verifyAdminSessionJwt(token);
  if (!jwtPayload?.sessionId) return null;

  const row = await fetchAdminSessionRow(jwtPayload.sessionId);
  if (!row || !isSessionRowActive(row)) return null;

  if (options?.touch !== false) {
    void touchAdminSessionEdge(jwtPayload.sessionId);
  }

  return jwtPayload;
}
