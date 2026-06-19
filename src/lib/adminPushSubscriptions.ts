import "server-only";

import type { AdminSessionPayload } from "@/lib/adminSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AdminPushSubscriptionRow = {
  id: string;
  admin_user_key: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
};

export function resolveAdminUserKey(session: AdminSessionPayload): string {
  if (session.adminUserId?.trim()) return session.adminUserId.trim();
  if (session.username?.trim()) return `bootstrap:${session.username.trim()}`;
  if (session.isBootstrapAdmin) return "bootstrap:admin";
  return "unknown";
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
    .select("id,admin_user_key,endpoint,p256dh,auth,user_agent,created_at,updated_at");
  if (error) throw error;
  return (data ?? []) as AdminPushSubscriptionRow[];
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
