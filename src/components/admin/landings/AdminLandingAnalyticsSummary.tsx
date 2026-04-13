"use client";

import { formatLandingAnalyticsRate } from "@/lib/adminLandings/analyticsDisplay";
import type { LandingAnalyticsSummary } from "@/lib/adminLandings/landingAnalyticsModels";

type Props = {
  summary: LandingAnalyticsSummary;
};

export default function AdminLandingAnalyticsSummary({ summary }: Props) {
  const cards: { label: string; value: string; hint?: string }[] = [
    { label: "총 랜딩 조회", value: summary.totalViews.toLocaleString("ko-KR") },
    { label: "총 CTA 클릭", value: summary.totalClicks.toLocaleString("ko-KR") },
    { label: "총 문의 전환", value: summary.totalSubmits.toLocaleString("ko-KR") },
    {
      label: "평균 CTR",
      value: formatLandingAnalyticsRate(summary.avgCTR, 1),
      hint: "전체 클릭 ÷ 전체 조회",
    },
    {
      label: "평균 CVR",
      value: formatLandingAnalyticsRate(summary.avgCVR, 1),
      hint: "전체 문의 ÷ 전체 클릭",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3"
        >
          <p className="text-xs text-[var(--text-muted)]">{c.label}</p>
          <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{c.value}</p>
          {c.hint ? <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{c.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}
