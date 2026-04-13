"use client";

import Link from "next/link";
import type { InquiryAssigneeStatRow } from "./inquiryDashboard.types";
import { buildInquiriesListUrl } from "./inquiryDashboard.utils";

type Props = { rows: InquiryAssigneeStatRow[] };

export function InquiryAssigneeStats({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-bold text-[var(--text-primary)]">담당자 워크로드</h2>
        <p className="mt-2 text-xs text-[var(--text-muted)]">배정된 문의가 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="text-sm font-bold text-[var(--text-primary)]">담당자 워크로드</h2>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">이름을 누르면 해당 담당자로 목록이 필터됩니다.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
              <th className="py-2 pr-2 font-semibold">담당자</th>
              <th className="py-2 pr-2 font-semibold tabular-nums">총 배정</th>
              <th className="py-2 pr-2 font-semibold tabular-nums">진행중</th>
              <th className="py-2 font-semibold tabular-nums">팔로업 지연</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const href = buildInquiriesListUrl({ assigneeFilter: r.name });
              return (
                <tr key={r.name} className="border-b border-[var(--border)]/60 last:border-0">
                  <td className="py-2 pr-2">
                    <Link href={href} className="font-medium text-[var(--primary)] hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-2 tabular-nums text-[var(--text-primary)]">{r.total.toLocaleString()}</td>
                  <td className="py-2 pr-2 tabular-nums text-[var(--text-primary)]">{r.inProgress.toLocaleString()}</td>
                  <td className="py-2 tabular-nums text-[var(--text-primary)]">{r.overdue.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
