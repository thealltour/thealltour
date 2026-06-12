"use client";

import type { QuickFilter } from "./inquiryQueue.utils";

type CardSpec = {
  id: Exclude<QuickFilter, "all">;
  label: string;
  value: number;
  tone: "slate" | "amber" | "red" | "rose";
};

const TONE: Record<CardSpec["tone"], string> = {
  slate: "border-slate-200 bg-slate-50/90 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:bg-slate-900/60",
  amber: "border-amber-200 bg-amber-50/90 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:hover:bg-amber-950/45",
  red: "border-red-200 bg-red-50/90 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/25 dark:hover:bg-red-950/40",
  rose: "border-rose-200 bg-rose-50/90 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/25 dark:hover:bg-rose-950/40",
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
    { id: "unresponded", label: "미응답", value: unresponded, tone: "amber" },
    { id: "overdue", label: "팔로업 지연", value: overdue, tone: "red" },
    { id: "today", label: "오늘 팔로업", value: today, tone: "rose" },
    { id: "hot", label: "HOT 리드", value: hot, tone: "amber" },
    { id: "unassigned", label: "미배정", value: unassigned, tone: "slate" },
    { id: "customer_reply", label: "고객 회신", value: customerReply, tone: "rose" },
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
