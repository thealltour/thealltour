"use client";

import { useId, useState } from "react";
import { Check } from "lucide-react";
import { formatCompletedStepAnswer } from "@/lib/planner/conversationCopy";
import type { PlannerDraftInput, PlannerWizardStep } from "@/types/planner";
import { PlannerUserAnswer } from "@/components/planner/conversation/PlannerUserAnswer";

type PlannerConversationHistoryProps = {
  completedSteps: PlannerWizardStep[];
  draft: PlannerDraftInput;
  disabled?: boolean;
  onEditStep: (step: PlannerWizardStep) => void;
  /** When true, hide history entirely (e.g. Step 7 has its own summary). */
  hidden?: boolean;
};

export function PlannerConversationHistory({
  completedSteps,
  draft,
  disabled,
  onEditStep,
  hidden = false,
}: PlannerConversationHistoryProps) {
  const listId = useId();
  const [expanded, setExpanded] = useState(false);

  if (hidden || completedSteps.length === 0) return null;

  const count = completedSteps.length;

  return (
    <div className="border-t border-[var(--border)] pt-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="flex min-w-0 items-center gap-2 type-small text-[var(--text-secondary)]">
          <span
            className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]"
            aria-hidden
          >
            <Check className="h-2 w-2" strokeWidth={3} />
          </span>
          <span>
            지금까지 선택한 조건 {count}개
          </span>
        </p>
        <button
          type="button"
          className="shrink-0 type-caption font-semibold text-[var(--primary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "접기" : "보기"}
        </button>
      </div>

      {expanded ? (
        <ol
          id={listId}
          className="mt-2 space-y-0"
          aria-label="지금까지 알려주신 여행 조건"
        >
          {completedSteps.map((s) => {
            const text = formatCompletedStepAnswer(s, draft);
            if (!text) return null;
            return (
              <li key={s}>
                <PlannerUserAnswer disabled={disabled} onEdit={() => onEditStep(s)}>
                  {text}
                </PlannerUserAnswer>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
