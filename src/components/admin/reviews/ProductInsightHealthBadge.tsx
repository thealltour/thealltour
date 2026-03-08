"use client";

import type { ProductReviewHealth } from "@/types/reviewProductInsights";

type ProductInsightHealthBadgeProps = {
  health: ProductReviewHealth;
  className?: string;
};

const STYLES: Record<ProductReviewHealth, string> = {
  healthy: "bg-green-100 text-green-800 border-green-200",
  watch: "bg-amber-100 text-amber-800 border-amber-200",
  risk: "bg-red-100 text-red-800 border-red-200",
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
