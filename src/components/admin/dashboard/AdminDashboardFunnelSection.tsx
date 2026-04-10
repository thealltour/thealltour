"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import type { FunnelModel } from "./useFunnelData";

type AdminDashboardFunnelSectionProps = {
  model: FunnelModel;
  isLoading?: boolean;
};

function formatConv(p: number | null) {
  if (p === null) return "—";
  return `${p}%`;
}

function FunnelArrow({
  conversion,
  mobile,
}: {
  conversion: FunnelModel["conversions"][0];
  mobile: boolean;
}) {
  const Icon = mobile ? ChevronDown : ChevronRight;
  return (
    <div
      className={`flex shrink-0 flex-col items-center justify-center gap-0.5 text-[var(--text-muted)] ${
        mobile ? "py-1" : "px-1"
      }`}
    >
      <Icon className="h-4 w-4 opacity-70" aria-hidden />
      <span className="text-[10px] font-semibold tabular-nums text-[var(--brand)]">{formatConv(conversion.percent)}</span>
    </div>
  );
}

export default function AdminDashboardFunnelSection({ model, isLoading }: AdminDashboardFunnelSectionProps) {
  if (isLoading) {
    return (
      <section className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-3 backdrop-blur-md md:p-4">
        <div className="mb-2 h-4 w-48 animate-pulse rounded bg-[var(--border)]" />
        <div className="h-24 animate-pulse rounded-lg bg-[var(--surface-muted)] md:h-20" />
      </section>
    );
  }

  const maxVal = Math.max(...model.steps.map((s) => s.value), 1);

  return (
    <section className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-3 backdrop-blur-md md:p-4">
      <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-sm font-bold text-[var(--text-primary)]">전환 퍼널</h2>
        <p className="max-w-md text-[10px] leading-snug text-[var(--text-muted)]">
          랜딩·클릭·검색은 위에서 고른 기간 기준입니다. 문의/예약/완료는 운영 누적 집계와 연결해 참고용으로 보여 줍니다.
        </p>
      </div>

      {/* Mobile: vertical */}
      <div className="mt-3 flex flex-col md:hidden">
        {model.steps.map((step, i) => (
          <div key={step.id}>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[var(--text-secondary)]">{step.label}</span>
                <span className="text-base font-bold tabular-nums text-[var(--text-primary)]">
                  {step.value.toLocaleString()}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--border)]/60">
                <div
                  className="h-full rounded-full bg-[var(--brand)]/80 transition-[width]"
                  style={{ width: `${Math.min(100, (step.value / maxVal) * 100)}%` }}
                />
              </div>
            </div>
            {i < model.conversions.length ? (
              <FunnelArrow conversion={model.conversions[i]!} mobile />
            ) : null}
          </div>
        ))}
      </div>

      {/* Desktop: horizontal 스크롤 (복잡한 그래프 없이 한 줄 흐름) */}
      <div className="mt-3 hidden md:flex md:flex-nowrap md:items-stretch md:gap-1 md:overflow-x-auto md:pb-1">
        {model.steps.map((step, i) => (
          <div key={step.id} className="flex shrink-0 items-stretch">
            <div className="flex w-[7.25rem] flex-col justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-2 lg:w-[8rem] lg:px-3">
              <p className="text-[10px] font-medium leading-tight text-[var(--text-muted)] lg:text-[11px]">{step.label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-[var(--text-primary)] lg:text-xl">
                {step.value.toLocaleString()}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border)]/60">
                <div
                  className="h-full rounded-full bg-[var(--brand)]/80"
                  style={{ width: `${Math.min(100, (step.value / maxVal) * 100)}%` }}
                />
              </div>
            </div>
            {i < model.conversions.length ? (
              <FunnelArrow conversion={model.conversions[i]!} mobile={false} />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
