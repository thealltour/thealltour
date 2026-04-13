"use client";

import Link from "next/link";
import type { InquiryDashboardSummary, InquiryRiskLists as RiskLists } from "./inquiryDashboard.types";
import { buildInquiriesListUrl, formatConsultationStatusLabel, formatShortDate } from "./inquiryDashboard.utils";

type Props = { riskLists: RiskLists };

function Row({ row }: { row: InquiryDashboardSummary }) {
  const detailHref = buildInquiriesListUrl({ id: row.id });
  return (
    <tr className="border-b border-[var(--border)]/50 last:border-0">
      <td className="py-2 pr-2 font-medium text-[var(--text-primary)]">{row.name || "—"}</td>
      <td className="py-2 pr-2 text-[var(--text-secondary)]">{formatShortDate(row.created_at)}</td>
      <td className="py-2 pr-2 text-[var(--text-secondary)]">{formatConsultationStatusLabel(row.consultation_status)}</td>
      <td className="py-2 pr-2 text-[var(--text-secondary)]">{row.assignee_name ?? "—"}</td>
      <td className="py-2 pr-2 text-[var(--text-secondary)]">{row.follow_up_at ? formatShortDate(row.follow_up_at) : "—"}</td>
      <td className="py-2 text-right">
        <Link
          href={detailHref}
          className="inline-flex rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface)]"
        >
          바로가기
        </Link>
      </td>
    </tr>
  );
}

function Block({
  title,
  hintHref,
  hintLabel,
  rows,
}: {
  title: string;
  hintHref: string;
  hintLabel: string;
  rows: InquiryDashboardSummary[];
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
        <Link href={hintHref} className="text-xs font-semibold text-[var(--primary)] hover:underline">
          {hintLabel}
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--text-muted)]">해당 없음</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <th className="py-2 pr-2 font-semibold">고객명</th>
                <th className="py-2 pr-2 font-semibold">문의일</th>
                <th className="py-2 pr-2 font-semibold">상태</th>
                <th className="py-2 pr-2 font-semibold">담당</th>
                <th className="py-2 pr-2 font-semibold">팔로업</th>
                <th className="py-2 font-semibold text-right">액션</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Row key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function InquiryRiskLists({ riskLists }: Props) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-bold text-[var(--text-primary)]">위험·즉시 조치</h2>
      <div className="grid gap-4 lg:grid-cols-1">
        <Block
          title="팔로업 지연"
          hintHref={buildInquiriesListUrl({ quickFilter: "overdue" })}
          hintLabel="전체 보기"
          rows={riskLists.overdue}
        />
        <Block
          title="미배정"
          hintHref={buildInquiriesListUrl({ assigneeFilter: "unassigned" })}
          hintLabel="전체 보기"
          rows={riskLists.unassigned}
        />
        <Block
          title="오래된 신규 (24h+)"
          hintHref={buildInquiriesListUrl({ status: "new", sort: "oldest" })}
          hintLabel="신규·오래된순"
          rows={riskLists.staleNew}
        />
      </div>
    </section>
  );
}
