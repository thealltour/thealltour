import "server-only";

import { parseAdminUserKey, toAdminUserKey } from "@/lib/adminChat/keys";
import type { AdminSessionPayload } from "@/lib/adminSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AdminPushSubscriptionRow = {
  id: string;
  admin_user_key: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  chat_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export function adminUserKeyMatchesSession(storedKey: string, sessionKey: string): boolean {
  const lookup = new Set(expandAdminUserKeysForLookup([sessionKey]));
  return lookup.has(storedKey.trim());
}

export function resolveAdminUserKey(session: AdminSessionPayload): string {
  try {
    return toAdminUserKey(session);
  } catch {
    if (session.username?.trim()) return `bootstrap:${session.username.trim()}`;
    if (session.isBootstrapAdmin) return "bootstrap:admin";
    return "unknown";
  }
}

function expandAdminUserKeysForLookup(keys: string[]): string[] {
  const expanded = new Set<string>();
  for (const key of keys) {
    const trimmed = key.trim();
    if (!trimmed) continue;
    expanded.add(trimmed);
    const parsed = parseAdminUserKey(trimmed);
    if (parsed?.kind === "user") expanded.add(parsed.userId);
    if (parsed?.kind === "bootstrap") expanded.add(parsed.username);
  }
  return [...expanded];
}

export function getWebPushVapidPublicKey(): string | null {
  const key = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  return key || null;
}

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() &&
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim(),
  );
}

export async function upsertAdminPushSubscription(input: {
  adminUserKey: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}) {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("admin_push_subscriptions").upsert(
    {
      admin_user_key: input.adminUserKey,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent?.trim() || null,
      updated_at: now,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

export async function deleteAdminPushSubscriptionByEndpoint(endpoint: string) {
  const { error } = await supabaseAdmin
    .from("admin_push_subscriptions")
    .delete()
    .eq("endpoint", endpoint.trim());
  if (error) throw error;
}

export async function deleteAdminPushSubscriptionById(id: string) {
  const { error } = await supabaseAdmin.from("admin_push_subscriptions").delete().eq("id", id);
  if (error) throw error;
}

export async function getAllAdminPushSubscriptions(): Promise<AdminPushSubscriptionRow[]> {
  const { data, error } = await supabaseAdmin
    .from("admin_push_subscriptions")
    .select(
      "id,admin_user_key,endpoint,p256dh,auth,user_agent,chat_enabled,created_at,updated_at",
    );
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...(row as AdminPushSubscriptionRow),
    chat_enabled: (row as { chat_enabled?: boolean }).chat_enabled !== false,
  }));
}

export async function getAdminPushSubscriptionsForUserKeys(
  userKeys: string[],
  options?: { chatOnly?: boolean },
): Promise<AdminPushSubscriptionRow[]> {
  const lookupKeys = expandAdminUserKeysForLookup(userKeys);
  if (lookupKeys.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("admin_push_subscriptions")
    .select(
      "id,admin_user_key,endpoint,p256dh,auth,user_agent,chat_enabled,created_at,updated_at",
    )
    .in("admin_user_key", lookupKeys);

  if (error) throw error;

  return (data ?? [])
    .map((row) => ({
      ...(row as AdminPushSubscriptionRow),
      chat_enabled: (row as { chat_enabled?: boolean }).chat_enabled !== false,
    }))
    .filter((row) => (options?.chatOnly ? row.chat_enabled : true));
}

export async function hasAdminPushSubscriptionForEndpoint(endpoint: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("admin_push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint.trim())
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
}

export async function getAdminPushSubscriptionByEndpoint(
  endpoint: string,
): Promise<AdminPushSubscriptionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("admin_push_subscriptions")
    .select(
      "id,admin_user_key,endpoint,p256dh,auth,user_agent,chat_enabled,created_at,updated_at",
    )
    .eq("endpoint", endpoint.trim())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...(data as AdminPushSubscriptionRow),
    chat_enabled: (data as { chat_enabled?: boolean }).chat_enabled !== false,
  };
}

export async function updateAdminPushSubscriptionChatEnabled(
  endpoint: string,
  chatEnabled: boolean,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("admin_push_subscriptions")
    .update({ chat_enabled: chatEnabled, updated_at: new Date().toISOString() })
    .eq("endpoint", endpoint.trim());
  if (error) throw error;
}
