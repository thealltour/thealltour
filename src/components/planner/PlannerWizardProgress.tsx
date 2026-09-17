"use client";

import { cn } from "@/lib/cn";
import { PLANNER_WIZARD_STEP_COUNT } from "@/lib/planner/constants";

type PlannerWizardProgressProps = {
  step: number;
};

export function PlannerWizardProgress({ step }: PlannerWizardProgressProps) {
  const safeStep = Math.min(PLANNER_WIZARD_STEP_COUNT, Math.max(1, step));
  const pct = Math.round((safeStep / PLANNER_WIZARD_STEP_COUNT) * 100);

  return (
    <div
      className="space-y-2"
      aria-label={`여행 조건을 알아가는 중 ${safeStep} / ${PLANNER_WIZARD_STEP_COUNT}`}
    >
      <div className="flex items-center justify-between type-caption text-[var(--text-muted)]">
        <span>여행 조건을 알아가는 중</span>
        <span>
          {safeStep}/{PLANNER_WIZARD_STEP_COUNT}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={PLANNER_WIZARD_STEP_COUNT}
        aria-valuenow={safeStep}
      >
        <div
          className={cn("h-full rounded-full bg-[var(--primary)] transition-[width] duration-200")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
