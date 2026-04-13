"use client";

import type { AssigneeFilter } from "./inquiryQueue.utils";

type Workload = { byName: Record<string, number>; unassigned: number };

type Props = {
  workload: Workload;
  assigneeFilter: AssigneeFilter;
  onPickAssignee: (next: AssigneeFilter) => void;
  capped?: boolean;
};

function pillClass(active: boolean): string {
  return `rounded-lg border px-2 py-1 text-[11px] transition ${
    active
      ? "border-[var(--primary)] bg-[var(--primary-soft)] font-medium text-[var(--primary)]"
      : "border-transparent bg-[var(--surface-muted)] text-[var(--text-muted)] hover:border-[var(--border)] hover:text-[var(--text-secondary)]"
  }`;
}

export function InquiryWorkloadSummary({ workload, assigneeFilter, onPickAssignee, capped }: Props) {
  const entries = Object.entries(workload.byName).sort(([a], [b]) => a.localeCompare(b, "ko"));
  const hasAny = entries.length > 0 || workload.unassigned > 0;

  if (!hasAny) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/50 px-3 py-2 text-[11px] text-[var(--text-subtle)]">
        담당 분포를 표시할 문의가 없습니다. (현재 검색·상태·퀵 필터 범위 기준, 최대 5,000건 집계)
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-[var(--text-muted)]">담당 분포</p>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([name, count]) => (
          <button
            key={name}
            type="button"
            onClick={() => onPickAssignee(name)}
            className={pillClass(assigneeFilter === name)}
          >
            {name}{" "}
            <span className="tabular-nums opacity-80">({count})</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPickAssignee("unassigned")}
          className={pillClass(assigneeFilter === "unassigned")}
        >
          미배정 <span className="tabular-nums opacity-80">({workload.unassigned})</span>
        </button>
      </div>
      {capped ? (
        <p className="text-[10px] text-[var(--text-subtle)]">집계 상한(5,000건)에 도달했을 수 있어 일부만 반영되었습니다.</p>
      ) : (
        <p className="text-[10px] text-[var(--text-subtle)]">검색·상태·퀵 필터와 동일한 조건(담당 필터 제외) 기준입니다.</p>
      )}
    </div>
  );
}
