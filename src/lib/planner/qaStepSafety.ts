import { validatePlannerStep } from "@/lib/planner/schemas";
import type { PlannerDraftInput, PlannerWizardStep } from "@/types/planner";

/**
 * Whether draft has enough validated prior steps to land on `target`.
 * Target step itself need not be complete (except step 7, which requires full draft).
 */
export function canArriveAtPlannerStep(
  draft: PlannerDraftInput,
  target: PlannerWizardStep,
): boolean {
  if (target === 1) return true;
  for (let s = 1; s < target; s++) {
    if (validatePlannerStep(s, draft) != null) return false;
  }
  if (target === 7) {
    return validatePlannerStep(7, draft) === null;
  }
  return true;
}
