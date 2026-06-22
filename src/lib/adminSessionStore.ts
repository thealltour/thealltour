import "server-only";

import type { AdminSessionPayload } from "@/lib/adminSession";
import {
  createAdminSessionToken,
  parseSessionPayloadFromJwt,
  verifyAdminSessionJwt,
} from "@/lib/adminSession";
import { parseAdminDeviceLabel } from "@/lib/adminDeviceLabel";
import { resolveAdminUserKey } from "@/lib/adminPushSubscriptions";
import {
  ADMIN_SESSION_TOUCH_THROTTLE_MS,
  getAdminSessionInactivityMs,
} from "@/lib/adminSessionPolicy";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AdminSessionRow = {
  id: string;
  admin_user_key: string;
  device_label: string | null;
  user_agent: string | null;
  last_seen_at: string;
  created_at: string;
  revoked_at: string | null;
};

export type AdminSessionListItem = {
  id: string;
  deviceLabel: string;
  userAgent: string | null;
  lastSeenAt: string;
  createdAt: string;
  isCurrent: boolean;
};

const touchThrottle = new Map<string, number>();

function isSessionActive(row: Pick<AdminSessionRow, "revoked_at" | "last_seen_at">): boolean {
  if (row.revoked_at) return false;
  const lastSeen = new Date(row.last_seen_at).getTime();
  if (!Number.isFinite(lastSeen)) return false;
  return Date.now() - lastSeen <= getAdminSessionInactivityMs();
}

async function getSessionRow(sessionId: string): Promise<AdminSessionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("admin_sessions")
    .select("id,admin_user_key,device_label,user_agent,last_seen_at,created_at,revoked_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return (data as AdminSessionRow | null) ?? null;
}

export async function createAdminSessionWithToken(
  session: AdminSessionPayload,
  meta?: { userAgent?: string | null },
): Promise<{ token: string; sessionId: string }> {
  const adminUserKey = resolveAdminUserKey(session);
  const userAgent = meta?.userAgent?.trim() || null;
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("admin_sessions")
    .insert({
      admin_user_key: adminUserKey,
      device_label: parseAdminDeviceLabel(userAgent),
      user_agent: userAgent,
      last_seen_at: now,
      created_at: now,
    })
    .select("id")
    .single();

  if (error) throw error;
  const sessionId = data.id as string;
  const token = await createAdminSessionToken(session, sessionId);
  return { token, sessionId };
}

export async function validateAdminSessionRow(
  sessionId: string,
): Promise<AdminSessionRow | null> {
  const row = await getSessionRow(sessionId);
  if (!row || !isSessionActive(row)) return null;
  return row;
}

export async function touchAdminSession(sessionId: string): Promise<void> {
  const last = touchThrottle.get(sessionId) ?? 0;
  if (Date.now() - last < ADMIN_SESSION_TOUCH_THROTTLE_MS) return;
  touchThrottle.set(sessionId, Date.now());

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("admin_sessions")
    .update({ last_seen_at: now })
    .eq("id", sessionId)
    .is("revoked_at", null);
  if (error) throw error;
}

export async function revokeAdminSession(sessionId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("admin_sessions")
    .update({ revoked_at: now })
    .eq("id", sessionId)
    .is("revoked_at", null);
  if (error) throw error;
  touchThrottle.delete(sessionId);
}

export async function revokeAllAdminSessions(
  adminUserKey: string,
  exceptSessionId?: string,
): Promise<number> {
  const now = new Date().toISOString();
  let query = supabaseAdmin
    .from("admin_sessions")
    .update({ revoked_at: now })
    .eq("admin_user_key", adminUserKey)
    .is("revoked_at", null);

  if (exceptSessionId) {
    query = query.neq("id", exceptSessionId);
  }

  const { data, error } = await query.select("id");
  if (error) throw error;
  for (const row of data ?? []) {
    touchThrottle.delete(row.id as string);
  }
  return data?.length ?? 0;
}

export async function listAdminSessionsForUser(
  adminUserKey: string,
  currentSessionId?: string | null,
): Promise<AdminSessionListItem[]> {
  const { data, error } = await supabaseAdmin
    .from("admin_sessions")
    .select("id,device_label,user_agent,last_seen_at,created_at,revoked_at")
    .eq("admin_user_key", adminUserKey)
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false })
    .limit(20);

  if (error) throw error;

  return (data ?? [])
    .filter((row) => isSessionActive(row as AdminSessionRow))
    .map((row) => ({
      id: row.id as string,
      deviceLabel: (row.device_label as string) || "알 수 없는 기기",
      userAgent: (row.user_agent as string | null) ?? null,
      lastSeenAt: row.last_seen_at as string,
      createdAt: row.created_at as string,
      isCurrent: Boolean(currentSessionId && row.id === currentSessionId),
    }));
}

export async function resolveAdminSessionFromToken(
  token: string | undefined | null,
  options?: { touch?: boolean },
): Promise<AdminSessionPayload | null> {
  const jwtPayload = await verifyAdminSessionJwt(token);
  if (!jwtPayload?.sessionId) return null;

  const row = await validateAdminSessionRow(jwtPayload.sessionId);
  if (!row) return null;

  if (options?.touch !== false) {
    try {
      await touchAdminSession(jwtPayload.sessionId);
    } catch {
      // touch 실패는 인증 자체를 막지 않음
    }
  }

  return jwtPayload;
}

export { parseSessionPayloadFromJwt };
