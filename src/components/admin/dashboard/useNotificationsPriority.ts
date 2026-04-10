import type { AdminNotificationItem } from "@/lib/adminNotifications";

/** 낮을수록 리스트 상단(중요). */
const TYPE_RANK: Record<string, number> = {
  new_inquiry: 0,
  new_review: 1,
  new_member: 2,
  birthday_upcoming: 3,
};

function rankForType(type: string): number {
  if (type in TYPE_RANK) return TYPE_RANK[type]!;
  return 10;
}

/**
 * 알림을 운영 중요도 순으로 정렬한 뒤, 동순위는 최신순.
 */
export function sortAdminNotificationsByPriority(items: AdminNotificationItem[]): AdminNotificationItem[] {
  return [...items].sort((a, b) => {
    const ra = rankForType(a.type ?? "");
    const rb = rankForType(b.type ?? "");
    if (ra !== rb) return ra - rb;
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
}

export function takePriorityNotifications(items: AdminNotificationItem[], limit: number): AdminNotificationItem[] {
  return sortAdminNotificationsByPriority(items).slice(0, limit);
}
