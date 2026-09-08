import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import type { HeaderPrimaryNavItem } from "@/components/header/headerNav.types";

/** Public creation entry; independent of the authenticated saved-plan menu. */
export function withPlannerNavigation(
  items: HeaderPrimaryNavItem[],
  enabled = ENABLE_FREE_TRAVEL_PLANNER,
): HeaderPrimaryNavItem[] {
  const result = items.filter((item) => item.key !== "planner");
  if (!enabled) return result;
  const inquiryIndex = result.findIndex((item) => item.key === "inquiry");
  result.splice(inquiryIndex < 0 ? result.length : inquiryIndex, 0, {
    key: "planner",
    label: "여행플래너",
    href: "/planner",
  });
  return result;
}

export function isPlannerPath(pathname: string): boolean {
  return pathname === "/planner" || pathname.startsWith("/planner/");
}
