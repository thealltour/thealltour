"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatLandingAnalyticsRate } from "@/lib/adminLandings/analyticsDisplay";
import type { LandingAnalyticsSummary, LandingAnalyticsTrendPoint } from "@/lib/adminLandings/landingAnalyticsModels";

type Props = {
  summary: LandingAnalyticsSummary;
  trend: LandingAnalyticsTrendPoint[];
};

function MiniRateLine({
  data,
  dataKey,
  color,
  empty,
}: {
  data: { date: string; v: number }[];
  dataKey: string;
  color: string;
  empty: boolean;
}) {
  if (empty || data.length === 0) {
    return (
      <div className="mt-2 flex h-[52px] items-center justify-center rounded-md border border-dashed border-[var(--border)] bg-[var(--surface-muted)] text-[10px] text-[var(--text-muted)]">
        일별 데이터 없음
      </div>
    );
  }

  return (
    <div className="mt-2 h-[52px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <XAxis dataKey="date" hide />
          <YAxis domain={[0, 1]} hide />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--surface-muted)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              fontSize: "11px",
              color: "var(--text-primary)",
            }}
            formatter={(value) => [
              formatLandingAnalyticsRate(typeof value === "number" ? value : Number(value), 1),
              "",
            ]}
            labelFormatter={(label) => String(label)}
          />
          <Line type="monotone" dataKey={dataKey} stroke={color} dot={false} strokeWidth={1.5} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AdminLandingAnalyticsConversionCards({ summary, trend }: Props) {
  const ctrSeries = trend.map((t) => ({ date: t.date, v: t.ctr }));
  const cvrSeries = trend.map((t) => ({ date: t.date, v: t.cvr }));
  const trendEmpty = trend.length === 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
        <p className="text-xs text-[var(--text-muted)]">전환율 · CTR</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
          {formatLandingAnalyticsRate(summary.avgCTR, 2)}
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">기간 내 전역 합산 · 클릭 ÷ 조회</p>
        <MiniRateLine data={ctrSeries} dataKey="v" color="#a78bfa" empty={trendEmpty} />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
        <p className="text-xs text-[var(--text-muted)]">전환율 · CVR</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
          {formatLandingAnalyticsRate(summary.avgCVR, 2)}
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">기간 내 전역 합산 · 문의 ÷ 클릭</p>
        <MiniRateLine data={cvrSeries} dataKey="v" color="#4ade80" empty={trendEmpty} />
      </div>
    </div>
  );
}
