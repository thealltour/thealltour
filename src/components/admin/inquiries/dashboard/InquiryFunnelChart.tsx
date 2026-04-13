"use client";

import Link from "next/link";
import type { InquiryDashboardPeriod, InquiryFunnel } from "./inquiryDashboard.types";
import { buildInquiriesListUrl, periodStartIso } from "./inquiryDashboard.utils";

type Props = { funnel: InquiryFunnel; period: InquiryDashboardPeriod };

const STEPS: {
  key: keyof InquiryFunnel;
  label: string;
  query: Record<string, string>;
}[] = [
  { key: "inquiry", label: "문의 접수", query: {} },
  { key: "contacted", label: "응대 진행", query: { status: "contacted" } },
  { key: "proposal", label: "제안·후속", query: { status: "in_progress" } },
  { key: "reserved", label: "예약확정", query: { status: "reserved" } },
];

export function InquiryFunnelChart({ funnel, period }: Props) {
  const start = periodStartIso(period);
  const max = Math.max(...STEPS.map((s) => funnel[s.key]), 1);

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="text-sm font-bold text-[var(--text-primary)]">전환 퍼널 (기간 내)</h2>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">단계별 건수이며, 단계 정의는 집계 API와 동일합니다.</p>
      <ol className="mt-4 space-y-2">
        {STEPS.map((step, i) => {
          const v = funnel[step.key];
          const w = Math.round((v / max) * 100);
          const href = buildInquiriesListUrl({
            createdAfter: start,
            ...step.query,
          });
          return (
            <li key={step.key}>
              <div className="flex items-center gap-2 text-[10px] font-semibold text-[var(--text-muted)]">
                <span className="w-4 tabular-nums">{i + 1}</span>
                <span className="flex-1 border-t border-dashed border-[var(--border)]" />
              </div>
              <Link
                href={href}
                className="mt-1 block rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 px-3 py-2 hover:bg-[var(--surface-muted)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">{step.label}</span>
                  <span className="text-sm font-bold tabular-nums text-[var(--text-primary)]">{v.toLocaleString()}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border)]/60">
                  <div className="h-full rounded-full bg-[var(--brand)]/80" style={{ width: `${w}%` }} />
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
