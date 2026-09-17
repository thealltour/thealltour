"use client";

import { useEffect, useRef } from "react";
import { PlannerConversationHistory } from "@/components/planner/conversation/PlannerConversationHistory";
import { PlannerWizardProgress } from "@/components/planner/PlannerWizardProgress";
import { getCompletedConversationSteps } from "@/lib/planner/conversationCopy";
import type { PlannerDraftInput, PlannerWizardStep } from "@/types/planner";
import { cn } from "@/lib/cn";

type PlannerConversationShellProps = {
  step: PlannerWizardStep;
  draft: PlannerDraftInput;
  editingFromSummary: boolean;
  disabled?: boolean;
  error?: string | null;
  onEditCompletedStep: (step: PlannerWizardStep) => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function PlannerConversationShell({
  step,
  draft,
  editingFromSummary,
  disabled,
  error,
  onEditCompletedStep,
  children,
  actions,
  className,
}: PlannerConversationShellProps) {
  const currentRef = useRef<HTMLDivElement>(null);
  const completedSteps = getCompletedConversationSteps({
    step,
    draft,
    editingFromSummary,
  });

  useEffect(() => {
    const el = currentRef.current;
    if (!el || typeof el.scrollIntoView !== "function") return;
    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [step]);

  return (
    <div className={cn("mx-auto w-full max-w-lg space-y-4", className)}>
      <div className="space-y-2">
        <PlannerWizardProgress step={step} />
      </div>

      <div ref={currentRef} className="space-y-4" data-testid="planner-conversation-current">
        {error ? (
          <p className="type-caption text-[var(--danger)]" role="alert" aria-live="polite">
            {error}
          </p>
        ) : null}
        {children}
      </div>

      <PlannerConversationHistory
        completedSteps={completedSteps}
        draft={draft}
        disabled={disabled}
        onEditStep={onEditCompletedStep}
        hidden={step === 7}
      />

      {actions ? <div className="space-y-2">{actions}</div> : null}
    </div>
  );
}
