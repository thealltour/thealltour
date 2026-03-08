"use client";

import type { ReviewAnalyticsResult } from "@/types/reviewAnalytics";

type TrustScoreDistributionChartProps = {
  analytics: ReviewAnalyticsResult;
};

const BANDS = ["0-20", "20-40", "40-60", "60-80", "80-100"] as const;
const BAND_LABELS: Record<string, string> = {
  "0-20": "0~20 (Risk)",
  "20-40": "20~40 (Low)",
  "40-60": "40~60 (Medium)",
  "60-80": "60~80 (High)",
  "80-100": "80~100 (Trusted)",
};

export function TrustScoreDistributionChart({ analytics }: TrustScoreDistributionChartProps) {
  const dist = analytics.trustScoreDistribution;
  if (!dist) return null;

  const total = BANDS.reduce((sum, b) => sum + (dist[b] ?? 0), 0);
  const maxCount = Math.max(...BANDS.map((b) => dist[b] ?? 0), 1);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Trust Score 분포</h3>
      <p className="mt-1 text-xs text-[var(--text-muted)]">총 {total}건</p>
      <div className="mt-4 space-y-3">
        {BANDS.map((band) => {
          const count = dist[band] ?? 0;
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={band} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs text-[var(--text-muted)]">
                {BAND_LABELS[band] ?? band}
              </span>
              <div className="h-6 flex-1 overflow-hidden rounded bg-[var(--surface-muted)]">
                <div
                  className="h-full rounded bg-[var(--chart-2)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs text-[var(--text-secondary)]">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
