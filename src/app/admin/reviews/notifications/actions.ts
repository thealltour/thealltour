"use server";

import {
  markReviewNotificationAsRead,
  markAllReviewNotificationsAsRead,
  archiveReviewNotification,
} from "@/lib/reviewNotifications";
import { generateReviewNotificationsFromSystemState } from "@/lib/reviewNotificationPipeline";

export async function markNotificationAsRead(id: string) {
  return markReviewNotificationAsRead(id);
}

export async function markAllNotificationsAsRead() {
  return markAllReviewNotificationsAsRead();
}

export async function archiveNotification(id: string) {
  return archiveReviewNotification(id);
}

export async function runReviewNotificationPipeline() {
  return generateReviewNotificationsFromSystemState();
}
