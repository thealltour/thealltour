"use client";

import type { QuickFilter } from "./inquiryQueue.utils";

type CardSpec = {
  id: Exclude<QuickFilter, "all">;
  label: string;
  value: number;
  tone: "neutral" | "warning" | "danger";
};

const TONE: Record<CardSpec["tone"], string> = {
  neutral: "border-[var(--border)] bg-[var(--surface-muted)]/90 hover:bg-[var(--surface-muted)]",
  warning: "border-[var(--warning)]/40 bg-[var(--warning-bg)]/90 hover:bg-[var(--warning-bg)]",
  danger: "border-[var(--danger)]/40 bg-[var(--danger-bg)]/90 hover:bg-[var(--danger-bg)]",
};

type Props = {
  unresponded: number;
  overdue: number;
  today: number;
  hot: number;
  unassigned: number;
  customerReply: number;
  activeQuick: QuickFilter;
  onSelectQuick: (f: QuickFilter) => void;
};

export function InquirySummaryCards({
  unresponded,
  overdue,
  today,
  hot,
  unassigned,
  customerReply,
  activeQuick,
  onSelectQuick,
}: Props) {
  const cards: CardSpec[] = [
    { id: "unresponded", label: "미응답", value: unresponded, tone: "warning" },
    { id: "overdue", label: "팔로업 지연", value: overdue, tone: "danger" },
    { id: "today", label: "오늘 팔로업", value: today, tone: "danger" },
    { id: "hot", label: "HOT 리드", value: hot, tone: "warning" },
    { id: "unassigned", label: "미배정", value: unassigned, tone: "neutral" },
    { id: "customer_reply", label: "고객 회신", value: customerReply, tone: "danger" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => {
        const selected = activeQuick === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelectQuick(c.id)}
            className={`rounded-xl border px-3 py-2.5 text-left shadow-sm transition ${TONE[c.tone]} ${
              selected ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface)]" : ""
            }`}
          >
            <p className="text-[11px] font-medium text-[var(--text-muted)]">{c.label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--text-primary)]">{c.value}</p>
          </button>
        );
      })}
    </div>
  );
}
