import type { ResearchSignalType } from "@/lib/marketing/research/types/enums";

const COMPATIBILITY_GROUPS: ResearchSignalType[][] = [
  ["policy_change", "entry_requirement", "visa", "safety"],
  ["event", "festival"],
  ["airfare", "flight_route"],
  ["weather", "seasonal_condition", "disruption"],
  ["general_travel_news", "destination_trend", "search_interest"],
  ["hotel_resort", "golf", "product_opportunity", "internal_product"],
  ["content_performance", "demand_signal"],
  ["competitor_signal", "exchange_rate"],
];

const GROUP_INDEX = new Map<ResearchSignalType, number>();
for (let i = 0; i < COMPATIBILITY_GROUPS.length; i += 1) {
  for (const type of COMPATIBILITY_GROUPS[i]!) {
    GROUP_INDEX.set(type, i);
  }
}

/** Whether two signal types may be compared for same-event semantic dedup. */
export function areSignalTypesSemanticallyCompatible(
  a: ResearchSignalType,
  b: ResearchSignalType,
): boolean {
  if (a === b) return true;
  const ga = GROUP_INDEX.get(a);
  const gb = GROUP_INDEX.get(b);
  if (ga == null || gb == null) return false;
  return ga === gb;
}
