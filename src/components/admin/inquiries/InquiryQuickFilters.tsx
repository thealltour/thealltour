"use client";

import type { QuickFilter } from "./inquiryQueue.utils";

const ITEMS: { id: QuickFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "unresponded", label: "미응답" },
  { id: "overdue", label: "팔로업 지연" },
  { id: "today", label: "오늘 팔로업" },
  { id: "hot", label: "HOT" },
  { id: "unassigned", label: "미배정" },
  { id: "customer_reply", label: "고객 회신 대기" },
];

type Props = {
  value: QuickFilter;
  onChange: (next: QuickFilter) => void;
};

export function InquiryQuickFilters({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-[var(--text-muted)]">퀵 필터</span>
      <div className="flex flex-wrap gap-1.5">
        {ITEMS.map((item) => {
          const active = value === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
