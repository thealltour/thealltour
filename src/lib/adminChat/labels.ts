import "server-only";

import { ADMIN_ROLE_PRESETS } from "@/lib/adminPermissions";
import type { AdminSessionPayload } from "@/lib/adminSession";
import { getAdminId } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseAdminUserKey, toAdminUserKey } from "@/lib/adminChat/keys";

export const BOOTSTRAP_ROLE_LABEL = "총괄 관리자";

export function rolePresetLabel(presetId: string): string {
  return ADMIN_ROLE_PRESETS.find((p) => p.id === presetId)?.label ?? presetId;
}

export type AdminChatParticipantProfile = {
  key: string;
  displayName: string;
  roleLabel: string;
  username?: string;
};

export async function resolveSenderProfile(
  session: AdminSessionPayload,
): Promise<Pick<AdminChatParticipantProfile, "displayName" | "roleLabel">> {
  if (session.isBootstrapAdmin) {
    return {
      displayName: session.username?.trim() || getAdminId() || "총괄 관리자",
      roleLabel: BOOTSTRAP_ROLE_LABEL,
    };
  }

  const userId = session.adminUserId?.trim();
  if (!userId) {
    return { displayName: "관리자", roleLabel: "관리자" };
  }

  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("username,display_name,role_preset")
    .eq("id", userId)
    .maybeSingle();

  if (!data) {
    return { displayName: session.username?.trim() || "관리자", roleLabel: "관리자" };
  }

  const row = data as { username: string; display_name: string | null; role_preset: string };
  return {
    displayName: row.display_name?.trim() || row.username,
    roleLabel: rolePresetLabel(row.role_preset),
  };
}

export async function resolveParticipantProfile(key: string): Promise<AdminChatParticipantProfile | null> {
  const parsed = parseAdminUserKey(key);
  if (!parsed) return null;

  if (parsed.kind === "bootstrap") {
    return {
      key: parsed.key,
      displayName: parsed.username,
      roleLabel: BOOTSTRAP_ROLE_LABEL,
      username: parsed.username,
    };
  }

  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("username,display_name,role_preset,is_active")
    .eq("id", parsed.userId)
    .maybeSingle();

  if (!data) return null;
  const row = data as {
    username: string;
    display_name: string | null;
    role_preset: string;
    is_active: boolean;
  };

  return {
    key: parsed.key,
    displayName: row.display_name?.trim() || row.username,
    roleLabel: rolePresetLabel(row.role_preset),
    username: row.username,
  };
}

export async function resolveParticipants(keys: string[]): Promise<AdminChatParticipantProfile[]> {
  const unique = [...new Set(keys)];
  const profiles = await Promise.all(unique.map((k) => resolveParticipantProfile(k)));
  return profiles.filter((p): p is AdminChatParticipantProfile => p !== null);
}

export function sessionToKey(session: AdminSessionPayload): string {
  return toAdminUserKey(session);
}
