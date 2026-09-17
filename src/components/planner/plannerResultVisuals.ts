import {
  CalendarDays,
  Camera,
  Coffee,
  MapPin,
  Plane,
  Scale,
  ShoppingBag,
  TrainFront,
  Users,
  Utensils,
  Waves,
} from "lucide-react";
import type {
  PlannerIconVisual,
  PlannerVisualTone,
} from "@/components/planner/conversation/plannerConversationIcons";
import type { PlannerPlanItem } from "@/lib/planner/planSchemas";

/** Result overview metadata cells (category meaning — not selected state). */
export const RESULT_OVERVIEW_VISUALS = {
  destination: { icon: Plane, tone: "blue" as const satisfies PlannerVisualTone },
  duration: { icon: CalendarDays, tone: "violet" as const satisfies PlannerVisualTone },
  travelers: { icon: Users, tone: "rose" as const satisfies PlannerVisualTone },
  pace: { icon: Scale, tone: "teal" as const satisfies PlannerVisualTone },
} as const satisfies Record<string, PlannerIconVisual>;

/** Itinerary item type → icon + tone for timeline rail nodes. */
export const ITEM_TYPE_VISUALS: Record<PlannerPlanItem["type"], PlannerIconVisual> = {
  attraction: { icon: Camera, tone: "blue" },
  food: { icon: Utensils, tone: "amber" },
  cafe: { icon: Coffee, tone: "rose" },
  shopping: { icon: ShoppingBag, tone: "violet" },
  activity: { icon: Waves, tone: "teal" },
  rest: { icon: Coffee, tone: "emerald" },
  transport: { icon: TrainFront, tone: "blue" },
  other: { icon: MapPin, tone: "slate" },
};
