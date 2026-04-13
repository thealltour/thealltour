"use client";

import Link from "next/link";
import type { InquirySourceRow } from "./inquiryDashboard.types";
import { buildInquiriesListUrl } from "./inquiryDashboard.utils";

type Props = { rows: InquirySourceRow[] };

export function InquirySourceBreakdown({ rows }: Props) {
  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="text-sm font-bold text-[var(--text-primary)]">유입 소스 (기간 내)</h2>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">행을 누르면 검색어로 목록을 엽니다.</p>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => {
          const w = Math.round((r.count / max) * 100);
          const href = buildInquiriesListUrl({ search: r.source });
          return (
            <li key={r.source}>
              <Link href={href} className="block rounded-lg px-1 py-0.5 hover:bg-[var(--surface-muted)]">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate font-medium text-[var(--text-secondary)]">{r.source}</span>
                  <span className="shrink-0 tabular-nums text-[var(--text-primary)]">{r.count.toLocaleString()}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--border)]/50">
                  <div className="h-full rounded-full bg-[var(--text-secondary)]/40" style={{ width: `${w}%` }} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
