import type { AdminSessionPayload } from "@/lib/adminSession";

export type AdminUserKeyKind = "bootstrap" | "user";

export type ParsedAdminUserKey =
  | { kind: "bootstrap"; username: string; key: string }
  | { kind: "user"; userId: string; key: string };

export function toAdminUserKey(
  session: Pick<AdminSessionPayload, "isBootstrapAdmin" | "adminUserId" | "username">,
): string {
  if (session.isBootstrapAdmin) {
    const username = session.username?.trim() || "bootstrap";
    return `bootstrap:${username}`;
  }
  const userId = session.adminUserId?.trim();
  if (!userId) {
    throw new Error("유효하지 않은 관리자 세션입니다.");
  }
  return `user:${userId}`;
}

export function parseAdminUserKey(key: string): ParsedAdminUserKey | null {
  const trimmed = key.trim();
  if (trimmed.startsWith("bootstrap:")) {
    const username = trimmed.slice("bootstrap:".length).trim();
    if (!username) return null;
    return { kind: "bootstrap", username, key: trimmed };
  }
  if (trimmed.startsWith("user:")) {
    const userId = trimmed.slice("user:".length).trim();
    if (!userId) return null;
    return { kind: "user", userId, key: trimmed };
  }
  return null;
}

export function buildDirectKey(keyA: string, keyB: string): string {
  return [keyA.trim(), keyB.trim()].sort().join(":");
}

export function isValidAdminUserKey(key: string): boolean {
  return parseAdminUserKey(key) !== null;
}
