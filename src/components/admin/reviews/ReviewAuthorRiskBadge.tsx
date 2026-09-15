"use client";

import type { AuthorRiskLevel } from "@/types/reviewAuthorProfile";

type ReviewAuthorRiskBadgeProps = {
  level: AuthorRiskLevel;
};

const LABELS: Record<AuthorRiskLevel, string> = {
  high: "고위험",
  medium: "주의",
  low: "양호",
};

const CLASSES: Record<AuthorRiskLevel, string> = {
  high: "bg-[var(--danger-bg)] text-[var(--danger)]",
  medium: "bg-[var(--warning-bg)] text-[var(--warning)]",
  low: "bg-green-100 text-green-800",
};

export function ReviewAuthorRiskBadge({ level }: ReviewAuthorRiskBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CLASSES[level] ?? ""}`}
    >
      {LABELS[level] ?? level}
    </span>
  );
}
