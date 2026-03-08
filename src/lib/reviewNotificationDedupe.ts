/**
 * PR29: 리뷰 운영 알림 dedupe 및 유사 이벤트 병합.
 */
import type { ReviewSystemEvent } from "@/types/reviewNotifications";
import type { ReviewNotificationItem } from "@/types/reviewNotifications";
import { REVIEW_NOTIFICATION_DEDUPE_WINDOW_MINUTES, SEVERITY_ORDER } from "./reviewNotificationConstants";

/**
 * 이벤트에서 dedupe 키 생성.
 * 동일 키 + 동일 severity + window 내 → 신규 생성 생략.
 */
export function buildNotificationDedupeKey(event: ReviewSystemEvent): string {
  const parts = [
    event.category,
    event.productId ?? "",
    event.reviewId ?? "",
    event.eventKey,
    event.severity,
    normalizeTitleForDedupe(event.title),
  ];
  return parts.filter(Boolean).join(":");
}

function normalizeTitleForDedupe(title: string): string {
  return title
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .replace(/[^\w\s가-힣]/g, "");
}

/**
 * 기존 알림과 비교해 dedupe window 내 중복 이벤트 제거.
 */
export function dedupeReviewSystemEvents(
  events: ReviewSystemEvent[],
  existingNotifications?: ReviewNotificationItem[],
): ReviewSystemEvent[] {
  const windowMs = REVIEW_NOTIFICATION_DEDUPE_WINDOW_MINUTES * 60 * 1000;
  const nowMs = Date.now();
  const existingKeys = new Set<string>();
  if (existingNotifications?.length) {
    for (const n of existingNotifications) {
      if (!n.dedupeKey) continue;
      const created = new Date(n.createdAt).getTime();
      if (nowMs - created <= windowMs) existingKeys.add(n.dedupeKey);
    }
  }
  const seenKeys = new Set<string>();
  return events.filter((e) => {
    const key = buildNotificationDedupeKey(e);
    if (existingKeys.has(key)) return false;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
}

/**
 * 유사 이벤트 병합 (선택적).
 * 이번 PR에서는 단순 dedupe만 적용하고 merge는 같은 키 내 1건만 남기는 수준.
 */
export function mergeSimilarEvents(events: ReviewSystemEvent[]): ReviewSystemEvent[] {
  const byKey = new Map<string, ReviewSystemEvent>();
  for (const e of events) {
    const key = buildNotificationDedupeKey(e);
    const existing = byKey.get(key);
    if (!existing || SEVERITY_ORDER[e.severity] < SEVERITY_ORDER[existing.severity]) {
      byKey.set(key, e);
    }
  }
  return [...byKey.values()];
}
