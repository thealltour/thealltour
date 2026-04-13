"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";
import type { AssigneeFilter } from "./inquiryQueue.utils";

type Props = {
  assigneeFilter: AssigneeFilter;
  onAssigneeFilterChange: (next: AssigneeFilter) => void;
  assignees: string[];
  selfDisplayName: string;
  /** blur 또는 Enter 시 저장 */
  onSelfDisplayNameCommit: (value: string) => void;
};

function chipClass(active: boolean): string {
  return active
    ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]";
}

export function InquiryAssigneeFilters({
  assigneeFilter,
  onAssigneeFilterChange,
  assignees,
  selfDisplayName,
  onSelfDisplayNameCommit,
}: Props) {
  const [nameDraft, setNameDraft] = useState(selfDisplayName);
  useEffect(() => {
    setNameDraft(selfDisplayName);
  }, [selfDisplayName]);

  return (
    <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[var(--text-muted)]">담당자</span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onAssigneeFilterChange("all")}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${chipClass(assigneeFilter === "all")}`}
          >
            전체
          </button>
          <button
            type="button"
            onClick={() => onAssigneeFilterChange("mine")}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition ${chipClass(assigneeFilter === "mine")}`}
          >
            <User className="h-3 w-3" aria-hidden />
            내 문의
          </button>
          <button
            type="button"
            onClick={() => onAssigneeFilterChange("unassigned")}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${chipClass(assigneeFilter === "unassigned")}`}
          >
            미배정
          </button>
        </div>
        {assignees.length > 0 ? (
          <label className="ml-auto flex min-w-[140px] flex-1 items-center gap-2 sm:max-w-[220px]">
            <span className="sr-only">담당자 선택</span>
            <select
              value={assigneeFilter !== "all" && assigneeFilter !== "mine" && assigneeFilter !== "unassigned" ? assigneeFilter : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) onAssigneeFilterChange("all");
                else onAssigneeFilterChange(v);
              }}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-soft)]"
            >
              <option value="">담당자 선택…</option>
              {assignees.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="flex flex-wrap items-end gap-2 border-t border-[var(--divider)] pt-2">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[11px] font-medium text-[var(--text-muted)]">
          내 문의함 이름
          <span className="font-normal text-[var(--text-subtle)]">문의에 저장한 담당자 이름과 동일하게 입력</span>
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => onSelfDisplayNameCommit(nameDraft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            placeholder="예: 홍길동"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-soft)]"
          />
        </label>
        {assigneeFilter === "mine" && !selfDisplayName.trim() ? (
          <p className="text-[11px] text-amber-700 dark:text-amber-300">이름을 입력하면 내 문의만 볼 수 있습니다.</p>
        ) : null}
      </div>
    </div>
  );
}
