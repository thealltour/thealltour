"use client";

import type { LandingAnalyticsRange, LandingAnalyticsSort } from "@/lib/adminLandings/landingAnalyticsModels";

type Props = {
  range: LandingAnalyticsRange;
  sort: LandingAnalyticsSort;
  onRangeChange: (range: LandingAnalyticsRange) => void;
  onSortChange: (sort: LandingAnalyticsSort) => void;
  disabled?: boolean;
};

export default function AdminLandingAnalyticsFilters({
  range,
  sort,
  onRangeChange,
  onSortChange,
  disabled,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
      <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <span>기간</span>
        <select
          value={range}
          disabled={disabled}
          onChange={(e) => onRangeChange(e.target.value as LandingAnalyticsRange)}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
        >
          <option value="7d">최근 7일</option>
          <option value="30d">최근 30일</option>
          <option value="all">전체</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <span>정렬</span>
        <select
          value={sort}
          disabled={disabled}
          onChange={(e) => onSortChange(e.target.value as LandingAnalyticsSort)}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
        >
          <option value="submits">문의 수(submit) 높은 순</option>
          <option value="ctr">CTR 높은 순</option>
        </select>
      </label>
    </div>
  );
}
