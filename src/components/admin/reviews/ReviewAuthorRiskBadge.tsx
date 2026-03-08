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
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
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
