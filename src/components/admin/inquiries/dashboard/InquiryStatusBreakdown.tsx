"use client";

import Link from "next/link";
import type { InquiryStatusBreakdown as Breakdown } from "./inquiryDashboard.types";
import { buildInquiriesListUrl } from "./inquiryDashboard.utils";

type Props = { breakdown: Breakdown };

const ROWS: { key: keyof Breakdown; label: string; status: string }[] = [
  { key: "new", label: "신규", status: "new" },
  { key: "contacted", label: "상담중", status: "contacted" },
  { key: "on_hold", label: "보류", status: "on_hold" },
  { key: "closed", label: "종료", status: "closed" },
];

export function InquiryStatusBreakdown({ breakdown }: Props) {
  const total = ROWS.reduce((s, r) => s + breakdown[r.key], 0) || 1;

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="text-sm font-bold text-[var(--text-primary)]">상담 상태 (기간 내 접수)</h2>
      <ul className="mt-3 space-y-2">
        {ROWS.map(({ key, label, status }) => {
          const n = breakdown[key];
          const pct = Math.round((n / total) * 100);
          const href = buildInquiriesListUrl({ status });
          return (
            <li key={key}>
              <Link href={href} className="block rounded-lg border border-transparent px-1 py-0.5 hover:border-[var(--border)] hover:bg-[var(--surface-muted)]">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-[var(--text-secondary)]">{label}</span>
                  <span className="tabular-nums text-[var(--text-primary)]">
                    {n.toLocaleString()} <span className="text-[var(--text-muted)]">({pct}%)</span>
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--border)]/50">
                  <div className="h-full rounded-full bg-[var(--brand)]/75" style={{ width: `${pct}%` }} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
