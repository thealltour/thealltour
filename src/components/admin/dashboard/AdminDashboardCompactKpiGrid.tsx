"use client";

import type { DashboardAdminCounts } from "./useDashboardData";
import { DashboardMetricTile } from "./DashboardMetricTile";

type AdminDashboardCompactKpiGridProps = {
  counts: DashboardAdminCounts | undefined;
  isLoading?: boolean;
};

export default function AdminDashboardCompactKpiGrid({ counts, isLoading }: AdminDashboardCompactKpiGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="h-[3.5rem] animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] md:h-[4rem]"
          />
        ))}
      </div>
    );
  }

  if (!counts) {
    return null;
  }

  const completionLabel = `${counts.completionRate}%`;
  const onHold = counts.onHoldInquiries ?? 0;

  return (
    <div>
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)] md:text-xs">
        문의 운영 KPI
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <DashboardMetricTile
          label="전체 문의"
          value={counts.totalInquiries}
          href="/admin/inquiries"
          changePercent={counts.totalInquiriesDeltaPercent}
        />
        <DashboardMetricTile
          label="미처리"
          value={counts.pendingInquiries}
          href="/admin/inquiries?status=pending"
          changePercent={counts.pendingInquiriesDeltaPercent}
        />
        <DashboardMetricTile
          label="완료"
          value={counts.completedInquiries}
          href="/admin/inquiries?status=completed"
          changePercent={counts.completedInquiriesDeltaPercent}
        />
        <DashboardMetricTile
          label="예약확정"
          value={counts.reservedInquiries}
          href="/admin/inquiries?status=reserved"
          footnote="—"
        />
        <DashboardMetricTile
          label="지연"
          value={counts.delayedInquiries}
          href="/admin/inquiries?status=delayed"
          changePercent={counts.delayedInquiriesDeltaPercent}
        />
        <DashboardMetricTile label="보류" value={onHold} href="/admin/inquiries?status=on_hold" footnote="큐 제외" />
        <DashboardMetricTile label="완료율" value={completionLabel} footnote="누적 비율" />
      </div>
    </div>
  );
}
