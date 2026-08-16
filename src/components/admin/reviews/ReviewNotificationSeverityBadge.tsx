"use client";

import type { ReviewNotificationSeverity } from "@/types/reviewNotifications";

const severityConfig: Record<
  ReviewNotificationSeverity,
  { label: string; className: string }
> = {
  critical: { label: "긴급", className: "bg-[var(--danger-bg)] text-[var(--danger)]" },
  warning: { label: "경고", className: "bg-[var(--warning-bg)] text-[var(--warning)]" },
  info: { label: "정보", className: "bg-[var(--primary-soft)] text-[var(--primary)]" },
};

export function ReviewNotificationSeverityBadge({
  severity,
}: {
  severity: ReviewNotificationSeverity;
}) {
  const { label, className } = severityConfig[severity];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
