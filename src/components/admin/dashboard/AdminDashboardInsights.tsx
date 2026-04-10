"use client";

import { AlertTriangle, Bell, Flag, Info, Search, TrendingDown, TrendingUp } from "lucide-react";
import type { DashboardInsight } from "./insightRules";

type AdminDashboardInsightsProps = {
  items: DashboardInsight[];
  isLoading?: boolean;
};

function severityStyles(severity: DashboardInsight["severity"]) {
  switch (severity) {
    case "high":
      return {
        border: "border-[var(--danger)]/35",
        bg: "bg-[var(--danger-bg)]/45",
        iconWrap: "bg-[var(--danger)]/15 text-[var(--danger)]",
        title: "text-[var(--danger)]",
      };
    case "medium":
      return {
        border: "border-[var(--warning)]/35",
        bg: "bg-[var(--warning-bg)]/40",
        iconWrap: "bg-[var(--warning)]/15 text-[var(--warning)]",
        title: "text-[var(--warning)]",
      };
    default:
      return {
        border: "border-[var(--brand)]/30",
        bg: "bg-[var(--surface-muted)]",
        iconWrap: "bg-[var(--brand)]/12 text-[var(--brand)]",
        title: "text-[var(--brand)]",
      };
  }
}

function InsightIcon({ type }: { type: string }) {
  const cls = "h-4 w-4 shrink-0";
  if (type === "inquiries") return <TrendingUp className={cls} aria-hidden />;
  if (type === "funnel") return <TrendingDown className={cls} aria-hidden />;
  if (type === "search") return <Search className={cls} aria-hidden />;
  if (type === "reviews") return <Flag className={cls} aria-hidden />;
  if (type === "notifications") return <Bell className={cls} aria-hidden />;
  if (type === "operations") return <AlertTriangle className={cls} aria-hidden />;
  return <Info className={cls} aria-hidden />;
}

export default function AdminDashboardInsights({ items, isLoading }: AdminDashboardInsightsProps) {
  if (isLoading) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--glass-surface)] p-3 backdrop-blur-md md:p-4">
        <div className="mb-2 h-4 w-36 animate-pulse rounded bg-[var(--border)]" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--glass-surface)] px-3 py-3 text-sm text-[var(--text-muted)] backdrop-blur-md md:px-4 md:py-3.5">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
          <span>자동 감지된 긴급 이상 징후가 없습니다. 기간·지표를 바꿔 다시 확인해 보세요.</span>
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-3 backdrop-blur-md md:p-4"
      aria-label="자동 인사이트"
    >
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">자동 인사이트</h2>
      <ul className="space-y-2">
        {items.map((item) => {
          const st = severityStyles(item.severity);
          return (
            <li
              key={item.id}
              className={`flex gap-3 rounded-lg border px-3 py-2.5 ${st.border} ${st.bg}`}
            >
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${st.iconWrap}`}
              >
                <InsightIcon type={item.type} />
              </span>
              <p className={`min-w-0 flex-1 text-sm font-medium leading-snug text-[var(--text-primary)]`}>
                <span className={`mr-1.5 text-xs font-bold uppercase ${st.title}`}>
                  {item.severity === "high" ? "긴급" : item.severity === "medium" ? "주의" : "참고"}
                </span>
                {item.message}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
