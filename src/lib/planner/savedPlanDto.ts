import type { PlannerPlan } from "@/lib/planner/planSchemas";
import { plannerPlanSchema } from "@/lib/planner/planSchemas";

/** Client-safe Saved Plan card DTO — never includes anonymous_key / member_id. */
export type SavedPlannerListItem = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  days: number;
  travelersSummary: string;
  styleSummary: string;
  updatedAt: string;
  sourceProductId: string | null;
};

export const SAVED_PLANNER_LIST_DEFAULT_LIMIT = 20;
export const SAVED_PLANNER_LIST_MAX_LIMIT = 50;

/** Project a validated plan into list DTO fields. Returns null if unusable. */
export function projectSavedPlannerListItem(params: {
  id: string;
  planJson: unknown;
  updatedAt: string;
  sourceProductId: string | null;
}): SavedPlannerListItem | null {
  const id = params.id?.trim();
  if (!id || !params.updatedAt) return null;
  if (params.planJson == null) return null;

  const parsed = plannerPlanSchema.safeParse(params.planJson);
  if (!parsed.success) return null;

  const plan: PlannerPlan = parsed.data;
  return {
    id,
    title: plan.title,
    destination: plan.destination.name,
    startDate: plan.tripOverview.startDate,
    endDate: plan.tripOverview.endDate,
    days: plan.tripOverview.days,
    travelersSummary: plan.tripOverview.travelersSummary,
    styleSummary: plan.tripOverview.styleSummary,
    updatedAt: params.updatedAt,
    sourceProductId: params.sourceProductId?.trim() || null,
  };
}
