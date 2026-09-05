import { createHash } from "crypto";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

/**
 * Stable fingerprint for the itinerary shape used by place enrichment.
 * Changes after AI edit so stale enrichments are not reused.
 */
export function computePlannerPlanFingerprint(plan: PlannerPlan): string {
  const payload = {
    title: plan.title,
    destination: plan.destination.name,
    startDate: plan.tripOverview.startDate,
    endDate: plan.tripOverview.endDate,
    days: plan.days.map((d) => ({
      day: d.day,
      date: d.date,
      items: d.items.map((i) => ({
        order: i.order,
        type: i.type,
        name: i.name,
        area: i.area,
      })),
    })),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32);
}
