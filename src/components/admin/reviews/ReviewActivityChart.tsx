"use client";

import type { ReviewAnalyticsResult } from "@/types/reviewAnalytics";

type ReviewActivityChartProps = {
  analytics: ReviewAnalyticsResult;
};

const MAX_BAR_HEIGHT = 80;

export function ReviewActivityChart({ analytics }: ReviewActivityChartProps) {
  const trend = analytics.recentReviewTrend;
  const maxCount = Math.max(...trend.map((d) => d.count), 1);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">최근 리뷰 활동</h3>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">최근 30일 날짜별 리뷰 수</p>
      <div className="mt-4 flex items-end justify-between gap-0.5">
        {trend.map((d) => {
          const h = (d.count / maxCount) * MAX_BAR_HEIGHT;
          const label = d.date.slice(5);
          return (
            <div
              key={d.date}
              className="flex flex-1 flex-col items-center"
              title={`${d.date}: ${d.count}건`}
            >
              <div
                className="w-full min-w-[2px] rounded-t bg-[var(--chart-1)]"
                style={{ height: `${Math.max(h, 2)}px` }}
              />
              <span className="mt-1 truncate text-[10px] text-[var(--text-muted)]">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
