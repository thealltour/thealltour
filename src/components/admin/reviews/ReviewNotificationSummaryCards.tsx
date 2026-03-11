"use client";

import AdminSummaryCard from "@/components/admin/ui/AdminSummaryCard";
import type { ReviewNotificationSummary } from "@/types/reviewNotifications";

const cards: Array<{ key: keyof ReviewNotificationSummary; label: string; className?: string }> = [
  { key: "total", label: "전체" },
  { key: "unread", label: "읽지 않음", className: "ring-1 ring-amber-400/50" },
  { key: "critical", label: "긴급", className: "ring-1 ring-red-400/50" },
  { key: "warning", label: "경고", className: "ring-1 ring-amber-400/30" },
];

export function ReviewNotificationSummaryCards({
  summary,
}: {
  summary: ReviewNotificationSummary;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map(({ key, label, className }) => (
        <AdminSummaryCard
          key={key}
          title={label}
          value={summary[key]}
          className={className}
        />
      ))}
    </div>
  );
}
