"use client";

import Link from "next/link";
import type { InquiryTrendPoint } from "./inquiryDashboard.types";
import { buildInquiriesListUrl } from "./inquiryDashboard.utils";

type Props = { trend: InquiryTrendPoint[] };

export function InquiryTrendChart({ trend }: Props) {
  const max = Math.max(...trend.map((t) => t.count), 1);
  const h = 120;

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="text-sm font-bold text-[var(--text-primary)]">일별 유입 (기간 내)</h2>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">막대를 누르면 해당일 이후 접수분만 목록에서 봅니다.</p>
      <div className="mt-4 flex items-end gap-1 overflow-x-auto pb-1" style={{ minHeight: h + 24 }}>
        {trend.map((p) => {
          const barH = Math.round((p.count / max) * h);
          const href = buildInquiriesListUrl({ createdAfter: `${p.date}T00:00:00.000Z` });
          return (
            <Link
              key={p.date}
              href={href}
              className="flex min-w-[1.75rem] flex-1 flex-col items-center gap-1"
              title={`${p.date}: ${p.count}건`}
            >
              <span className="text-[10px] font-medium tabular-nums text-[var(--text-secondary)]">{p.count}</span>
              <div
                className="w-full max-w-[2rem] rounded-t bg-[var(--brand)]/70 transition-colors hover:bg-[var(--brand)]"
                style={{ height: Math.max(barH, p.count > 0 ? 4 : 0) }}
              />
              <span className="max-w-full truncate text-[9px] text-[var(--text-muted)]">{p.date.slice(5)}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
