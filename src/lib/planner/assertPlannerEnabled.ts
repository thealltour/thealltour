import { notFound } from "next/navigation";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";

/** Call at the top of Planner pages/routes when the feature must be hidden. */
export function assertFreeTravelPlannerEnabled(): void {
  if (!ENABLE_FREE_TRAVEL_PLANNER) {
    notFound();
  }
}
