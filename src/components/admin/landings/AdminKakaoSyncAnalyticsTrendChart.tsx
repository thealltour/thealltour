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
import type { KakaoSyncAnalyticsTrendPoint } from "@/lib/adminLandings/kakaoSyncAnalyticsModels";

type Props = {
  trend: KakaoSyncAnalyticsTrendPoint[];
};

function formatTick(ymd: string): string {
  const [, m, d] = ymd.split("-");
  if (!m || !d) return ymd;
  return `${m}/${d}`;
}

export default function AdminKakaoSyncAnalyticsTrendChart({ trend }: Props) {
  if (trend.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 text-center text-sm text-[var(--text-muted)]">
        선택한 기간에 표시할 일별 추이 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">일별 추이</h2>
      <p className="mb-4 text-xs text-[var(--text-muted)]">조회 · CTA · OAuth 시작 · 신규 가입</p>
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
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} width={40} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--surface-muted)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "var(--text-primary)",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }}
              formatter={(value) => {
                if (value === "views") return "조회";
                if (value === "clicks") return "CTA";
                if (value === "oauthStarts") return "OAuth";
                if (value === "signups") return "가입";
                return value;
              }}
            />
            <Line type="monotone" dataKey="views" stroke="#38bdf8" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="clicks" stroke="#a78bfa" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="oauthStarts" stroke="#fbbf24" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="signups" stroke="#4ade80" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
