export type AdminWebPushPayload = {
  title: string;
  body: string;
  url: string;
  type: string;
  unreadCount: number;
};

/** Web Push payload JSON (Service Worker push 이벤트와 동일 스키마) */
export function buildAdminWebPushPayload(input: {
  title: string;
  body: string;
  targetUrl?: string | null;
  type?: string;
  unreadCount: number;
}): AdminWebPushPayload {
  return {
    title: input.title.trim() || "더올투어 관리",
    body: input.body.trim(),
    url: input.targetUrl?.trim() || "/theall_manager_only/notifications",
    type: input.type?.trim() || "admin-notification",
    unreadCount: Math.max(0, Math.floor(input.unreadCount)),
  };
}

/** web-push 만료·무효 구독 HTTP 상태 */
export function isExpiredPushSubscriptionStatus(statusCode: number): boolean {
  return statusCode === 404 || statusCode === 410;
}
