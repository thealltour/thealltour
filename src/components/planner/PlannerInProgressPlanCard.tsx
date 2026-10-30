"use client";

import Link from "next/link";
import { formatIsoDateDot } from "@/lib/planner/dates";
import type { SavedPlannerListItem } from "@/lib/planner/savedPlanDto";

function formatDateRange(plan: SavedPlannerListItem): string {
  if (plan.dateMode === "flexible" || !plan.startDate || !plan.endDate) {
    return `${plan.days}일 · 날짜 미정`;
  }
  const start = formatIsoDateDot(plan.startDate);
  const end = formatIsoDateDot(plan.endDate);
  const endShort = end.length >= 10 ? end.slice(5) : end;
  return `${start} - ${endShort}`;
}

type PlannerInProgressPlanCardProps = {
  plan: SavedPlannerListItem;
};

/** Member-owned generated plan — never labeled as saved. */
export function PlannerInProgressPlanCard({ plan }: PlannerInProgressPlanCardProps) {
  const href = `/planner/${plan.id}`;

  return (
    <Link
      href={href}
      className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      data-testid="planner-in-progress-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="type-body font-semibold text-[var(--foreground)]">{plan.title}</h2>
            <span className="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 type-caption font-medium text-[var(--text-secondary)]">
              작성 중
            </span>
          </div>
          <p className="type-small text-[var(--text-secondary)]">
            {plan.destination}
            {plan.days > 0 ? ` · ${plan.days}일 일정` : null}
          </p>
          <p className="type-caption text-[var(--text-muted)]">{formatDateRange(plan)}</p>
          <p className="type-caption text-[var(--text-muted)]">아직 저장하지 않은 플랜</p>
        </div>
        <span className="shrink-0 type-small font-medium text-[var(--primary)]">이어서 보기</span>
      </div>
    </Link>
  );
}
