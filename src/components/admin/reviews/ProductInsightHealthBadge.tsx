"use client";

import type { ProductReviewHealth } from "@/types/reviewProductInsights";

type ProductInsightHealthBadgeProps = {
  health: ProductReviewHealth;
  className?: string;
};

const STYLES: Record<ProductReviewHealth, string> = {
  healthy: "bg-[var(--success-bg)] text-[var(--success)] border-[var(--success)]/30",
  watch: "bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning)]/30",
  risk: "bg-[var(--danger-bg)] text-[var(--danger)] border-[var(--danger)]/30",
};

const LABELS: Record<ProductReviewHealth, string> = {
  healthy: "Healthy",
  watch: "Watch",
  risk: "Risk",
};

export function ProductInsightHealthBadge({ health, className = "" }: ProductInsightHealthBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[health]} ${className}`}
    >
      {LABELS[health]}
    </span>
  );
}
