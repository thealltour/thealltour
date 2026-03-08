"use client";

import type { ReviewNotificationCategory } from "@/types/reviewNotifications";

const categoryConfig: Record<
  ReviewNotificationCategory,
  { label: string; className: string }
> = {
  anomaly: { label: "이상", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  moderation: { label: "검토", className: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300" },
  report: { label: "신고", className: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
  trust: { label: "신뢰", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  conversion: { label: "전환", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  insight: { label: "인사이트", className: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300" },
  experiment: { label: "실험", className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300" },
};

export function ReviewNotificationCategoryBadge({
  category,
}: {
  category: ReviewNotificationCategory;
}) {
  const { label, className } = categoryConfig[category];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
