"use client";

import { fromDbStatus } from "@/types/reviewModeration";
import type { ReviewModerationStatus } from "@/types/reviewModeration";

type ReviewStatusBadgeProps = {
  status: ReviewModerationStatus | string;
};

const LABELS: Record<ReviewModerationStatus, string> = {
  visible: "표시",
  hidden: "숨김",
  under_review: "검토중",
  flagged: "신고됨",
};

function getStatusDisplay(dbStatus: string): ReviewModerationStatus {
  return fromDbStatus(dbStatus);
}

export function ReviewStatusBadge({ status }: ReviewStatusBadgeProps) {
  const s = typeof status === "string" ? getStatusDisplay(status) : status;
  const label = LABELS[s] ?? s;

  const classes =
    s === "visible"
      ? "bg-green-100 text-green-800"
      : s === "hidden"
        ? "bg-slate-200 text-slate-700"
        : s === "under_review"
          ? "bg-amber-100 text-amber-800"
          : "bg-red-100 text-red-800";

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}
