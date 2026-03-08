/**
 * PR29: 리뷰 시스템 운영 알림 타입.
 */

export type ReviewNotificationCategory =
  | "anomaly"
  | "moderation"
  | "report"
  | "trust"
  | "conversion"
  | "insight"
  | "experiment";

export type ReviewNotificationSeverity = "info" | "warning" | "critical";

export type ReviewNotificationStatus = "unread" | "read" | "archived";

export interface ReviewSystemEvent {
  eventKey: string;
  category: ReviewNotificationCategory;
  severity: ReviewNotificationSeverity;
  productId?: string;
  reviewId?: string;
  authorKey?: string;
  title: string;
  message: string;
  reasons?: string[];
  metadata?: Record<string, unknown>;
  occurredAt: string;
}

export interface ReviewNotificationItem {
  id: string;
  eventKey: string;
  category: ReviewNotificationCategory;
  severity: ReviewNotificationSeverity;
  status: ReviewNotificationStatus;
  productId?: string | null;
  reviewId?: string | null;
  title: string;
  message: string;
  createdAt: string;
  dedupeKey?: string | null;
  sourceMetadata?: Record<string, unknown> | null;
}

export interface ReviewNotificationSummary {
  total: number;
  unread: number;
  critical: number;
  warning: number;
  info: number;
}

export type ReviewNotificationChannel = "in_app" | "slack" | "email" | "webhook";

export interface ReviewNotificationRule {
  category: ReviewNotificationCategory;
  minSeverity: ReviewNotificationSeverity;
  channels: ReviewNotificationChannel[];
}

export interface ReviewNotificationDigestItem {
  notification: ReviewNotificationItem;
  groupedCount?: number;
}
