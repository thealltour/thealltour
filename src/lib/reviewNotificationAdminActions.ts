"use server";

import { generateReviewNotificationsFromSystemState } from "@/lib/reviewNotificationPipeline";

/**
 * 수동으로 알림 파이프라인 실행. dedupe 적용으로 반복 클릭해도 중복 알림 최소화.
 */
export async function runReviewNotificationPipeline() {
  return generateReviewNotificationsFromSystemState();
}
