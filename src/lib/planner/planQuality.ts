import type { PlannerPlan } from "@/lib/planner/planSchemas";
import type { PlannerDraftInput, PlannerPace } from "@/types/planner";

export type PlannerDayRole = "one_day" | "arrival" | "departure" | "full";

export type PlannerPlanQualityIssueCode = "day_item_density_too_low";

export type PlannerPlanQualityIssue = {
  code: PlannerPlanQualityIssueCode;
  day: number;
  actual: number;
  expectedMinimum: number;
  pace: PlannerPace;
  dayRole: PlannerDayRole;
};

export type PlannerPlanQualityResult =
  | { ok: true }
  | { ok: false; issue: PlannerPlanQualityIssue };

export type PlannerItemDensityStats = {
  totalItemCount: number;
  minItemsPerDay: number;
  maxItemsPerDay: number;
  averageItemsPerDay: number;
};

export class PlannerPlanQualityError extends Error {
  readonly code: PlannerPlanQualityIssueCode;
  readonly issue: PlannerPlanQualityIssue;

  constructor(issue: PlannerPlanQualityIssue) {
    super(
      `Plan quality validation failed: day ${issue.day} has ${issue.actual} items (min ${issue.expectedMinimum})`,
    );
    this.name = "PlannerPlanQualityError";
    this.code = issue.code;
    this.issue = issue;
  }
}

export function getPlannerDayRole(dayIndex: number, dayCount: number): PlannerDayRole {
  if (dayCount <= 1) return "one_day";
  if (dayIndex === 0) return "arrival";
  if (dayIndex === dayCount - 1) return "departure";
  return "full";
}

/** Hard minimum itinerary item count for semantic quality (not schema). */
export function getPlannerDayMinimumItems(params: {
  dayIndex: number;
  dayCount: number;
  pace: PlannerPace;
}): number {
  const role = getPlannerDayRole(params.dayIndex, params.dayCount);
  if (role === "one_day" || role === "arrival" || role === "departure") {
    return 2;
  }
  if (params.pace === "relaxed") return 2;
  if (params.pace === "packed") return 4;
  return 3;
}

/**
 * Semantic density check after structural schema + draft invariants.
 * Counts all itinerary items (food/cafe/rest/transport included); no type filtering.
 */
export function validatePlannerPlanQuality(
  plan: PlannerPlan,
  draft: Pick<PlannerDraftInput, "pace">,
): PlannerPlanQualityResult {
  const pace = draft.pace;
  const dayCount = plan.days.length;

  for (let i = 0; i < dayCount; i += 1) {
    const day = plan.days[i]!;
    const expectedMinimum = getPlannerDayMinimumItems({
      dayIndex: i,
      dayCount,
      pace,
    });
    const actual = day.items.length;
    if (actual < expectedMinimum) {
      return {
        ok: false,
        issue: {
          code: "day_item_density_too_low",
          day: day.day,
          actual,
          expectedMinimum,
          pace,
          dayRole: getPlannerDayRole(i, dayCount),
        },
      };
    }
  }

  return { ok: true };
}

export function assertPlannerPlanQuality(
  plan: PlannerPlan,
  draft: Pick<PlannerDraftInput, "pace">,
): void {
  const result = validatePlannerPlanQuality(plan, draft);
  if (!result.ok) {
    throw new PlannerPlanQualityError(result.issue);
  }
}

export function getPlannerItemDensityStats(plan: PlannerPlan): PlannerItemDensityStats {
  const counts = plan.days.map((d) => d.items.length);
  if (counts.length === 0) {
    return {
      totalItemCount: 0,
      minItemsPerDay: 0,
      maxItemsPerDay: 0,
      averageItemsPerDay: 0,
    };
  }
  const totalItemCount = counts.reduce((sum, n) => sum + n, 0);
  return {
    totalItemCount,
    minItemsPerDay: Math.min(...counts),
    maxItemsPerDay: Math.max(...counts),
    averageItemsPerDay: Math.round((totalItemCount / counts.length) * 100) / 100,
  };
}
