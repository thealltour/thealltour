"use client";

import type { AdminSessionPermissions } from "@/lib/adminPermissions";

export function deriveClientAdminUserKey(session: AdminSessionPermissions): string | null {
  if (session.isBootstrapAdmin) {
    const username = session.username?.trim();
    return username ? `bootstrap:${username}` : null;
  }
  const userId = session.adminUserId?.trim();
  return userId ? `user:${userId}` : null;
}

export function isAdminChatSessionActive(session: AdminSessionPermissions): boolean {
  return Boolean(deriveClientAdminUserKey(session));
}

export function formatChatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return time;

  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncatePreview(text: string, max = 48): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max)}…`;
}
