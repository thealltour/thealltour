"use client";

import type { ReviewAnalyticsResult } from "@/types/reviewAnalytics";

type RatingDistributionChartProps = {
  analytics: ReviewAnalyticsResult;
};

const STARS = [1, 2, 3, 4, 5] as const;
const MAX_BAR = 100;

export function RatingDistributionChart({ analytics }: RatingDistributionChartProps) {
  const dist = analytics.ratingDistribution;
  const maxCount = Math.max(...STARS.map((s) => dist[s] ?? 0), 1);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">평점 분포</h3>
      <div className="mt-4 space-y-3">
        {STARS.map((star) => {
          const count = dist[star] ?? 0;
          const pct = (count / maxCount) * MAX_BAR;
          return (
            <div key={star} className="flex items-center gap-3">
              <span className="w-8 text-sm text-[var(--text-muted)]">{star}★</span>
              <div className="h-6 flex-1 overflow-hidden rounded bg-[var(--surface-muted)]">
                <div
                  className="h-full rounded bg-[var(--chart-1)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-10 text-right text-xs text-[var(--text-secondary)]">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
