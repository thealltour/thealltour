"use client";

import Link from "next/link";
import { AlertTriangle, Bell, ChevronRight, Flag, MessageSquare } from "lucide-react";
import type { DashboardPriorityItem } from "./useDashboardPriority";

type AdminDashboardPriorityPanelProps = {
  items: DashboardPriorityItem[];
  isLoading?: boolean;
};

function toneClasses(priority: DashboardPriorityItem["priority"]) {
  switch (priority) {
    case "high":
      return {
        card: "border-[var(--danger)]/35 bg-[var(--danger-bg)]/45 shadow-sm",
        iconWrap: "bg-[var(--danger-bg)] text-[var(--danger)] ring-1 ring-[var(--danger)]/25",
        count: "text-[var(--danger)]",
        label: "text-[var(--text-primary)]",
        cta: "text-[var(--danger)]",
      };
    case "medium":
      return {
        card: "border-[var(--warning)]/40 bg-[var(--warning-bg)]/50 shadow-sm",
        iconWrap: "bg-[var(--warning-bg)] text-[var(--warning)] ring-1 ring-[var(--warning)]/30",
        count: "text-[var(--warning)]",
        label: "text-[var(--text-primary)]",
        cta: "text-[var(--warning)]",
      };
    default:
      return {
        card: "border-[var(--brand)]/30 bg-[var(--surface-muted)] shadow-sm",
        iconWrap: "bg-[var(--surface)] text-[var(--brand)] ring-1 ring-[var(--brand)]/20",
        count: "text-[var(--brand)]",
        label: "text-[var(--text-primary)]",
        cta: "text-[var(--brand)]",
      };
  }
}

function ItemIcon({ type }: { type: string }) {
  const cls = "h-5 w-5 shrink-0";
  if (type === "delayed") return <AlertTriangle className={cls} aria-hidden />;
  if (type === "review_flagged" || type === "review_high") return <Flag className={cls} aria-hidden />;
  if (type === "pending") return <MessageSquare className={cls} aria-hidden />;
  return <Bell className={cls} aria-hidden />;
}

export default function AdminDashboardPriorityPanel({ items, isLoading }: AdminDashboardPriorityPanelProps) {
  if (isLoading) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm md:p-4">
        <div className="mb-3 h-3.5 w-36 animate-pulse rounded bg-[var(--border)]" />
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-[5.5rem] animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]" />
          ))}
        </ul>
      </section>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm md:p-4">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">우선 처리 필요</h2>
      <ul className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {items.map((item) => {
          const tone = toneClasses(item.priority);
          return (
            <li key={item.id} className="min-w-0">
              <Link
                href={item.href}
                className={`flex min-h-[5.5rem] flex-col rounded-lg border px-2.5 py-2 text-left transition-[transform,box-shadow,border-color] hover:-translate-y-px hover:shadow-md active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] md:min-h-[5.75rem] md:px-3 md:py-2.5 ${tone.card}`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg md:h-10 md:w-10 ${tone.iconWrap}`}
                    aria-hidden
                  >
                    <ItemIcon type={item.type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-lg font-bold tabular-nums leading-tight md:text-xl ${tone.count}`}>{item.count}건</p>
                    <p className={`mt-0.5 line-clamp-2 text-[11px] font-semibold leading-snug md:text-xs ${tone.label}`}>
                      {item.label}
                    </p>
                  </div>
                </div>
                <span
                  className={`mt-auto flex items-center justify-end gap-0.5 pt-1.5 text-[10px] font-bold md:text-[11px] ${tone.cta}`}
                >
                  바로 처리
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
