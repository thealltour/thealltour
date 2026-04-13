"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LandingAnalyticsTrendPoint } from "@/lib/adminLandings/landingAnalyticsModels";

type Props = {
  trend: LandingAnalyticsTrendPoint[];
};

const COLORS = {
  views: "#38bdf8",
  clicks: "#a78bfa",
  submits: "#4ade80",
};

function formatTick(ymd: string): string {
  const [, m, d] = ymd.split("-");
  if (!m || !d) return ymd;
  return `${m}/${d}`;
}

export default function AdminLandingAnalyticsTrendChart({ trend }: Props) {
  if (trend.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 text-center text-sm text-[var(--text-muted)]">
        선택한 기간에 표시할 일별 추이 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">기간별 추이</h2>
      <p className="mb-4 text-xs text-[var(--text-muted)]">일별 조회 · CTA 클릭 · 문의 전환</p>
      <div className="h-[280px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" opacity={0.6} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              tickFormatter={formatTick}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              width={40}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--surface-muted)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "var(--text-primary)",
              }}
              labelFormatter={(label) => String(label)}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }}
              formatter={(value) => {
                if (value === "views") return "조회";
                if (value === "clicks") return "CTA 클릭";
                if (value === "submits") return "문의";
                return value;
              }}
            />
            <Line type="monotone" dataKey="views" name="views" stroke={COLORS.views} dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="clicks" name="clicks" stroke={COLORS.clicks} dot={false} strokeWidth={2} />
            <Line
              type="monotone"
              dataKey="submits"
              name="submits"
              stroke={COLORS.submits}
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
