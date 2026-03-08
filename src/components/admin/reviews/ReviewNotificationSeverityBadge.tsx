"use client";

import type { ReviewNotificationSeverity } from "@/types/reviewNotifications";

const severityConfig: Record<
  ReviewNotificationSeverity,
  { label: string; className: string }
> = {
  critical: { label: "긴급", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  warning: { label: "경고", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  info: { label: "정보", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
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
