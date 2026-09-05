"use client";

import Link from "next/link";
import { trackPlannerSavedPlanOpened } from "@/lib/analytics/trackPlannerEvents";
import type { SavedPlannerListItem } from "@/lib/planner/savedPlanDto";

function formatDateRange(startDate: string, endDate: string): string {
  const fmt = (ymd: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return ymd;
    return `${m[1]}.${m[2]}.${m[3]}`;
  };
  return `${fmt(startDate)} - ${fmt(endDate)}`;
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type PlannerSavedPlanCardProps = {
  plan: SavedPlannerListItem;
};

export function PlannerSavedPlanCard({ plan }: PlannerSavedPlanCardProps) {
  const href = `/planner/${plan.id}`;

  return (
    <Link
      href={href}
      className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      onClick={() => {
        trackPlannerSavedPlanOpened({
          sessionId: plan.id,
          destination: plan.destination,
          sourceProductId: plan.sourceProductId,
        });
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h2 className="type-body font-semibold text-[var(--foreground)]">{plan.title}</h2>
          <p className="type-small text-[var(--text-secondary)]">
            {plan.destination}
            {plan.days > 0 ? ` · ${plan.days}일 일정` : null}
          </p>
          <p className="type-caption text-[var(--text-muted)]">
            {formatDateRange(plan.startDate, plan.endDate)}
          </p>
          <p className="type-caption text-[var(--text-muted)]">
            {[plan.travelersSummary, plan.styleSummary].filter(Boolean).join(" · ")}
          </p>
          {formatUpdatedAt(plan.updatedAt) ? (
            <p className="type-caption text-[var(--text-muted)]">
              최근 저장 {formatUpdatedAt(plan.updatedAt)}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 type-small font-medium text-[var(--primary)]">플랜 보기</span>
      </div>
    </Link>
  );
}
