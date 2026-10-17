import { compactActivityName } from "@/lib/affiliate/planner/discovery/normalizeActivityName";
import type { TossTravelGoodsIntent } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingTypes";
import type { AffiliateRoutingContext } from "@/lib/affiliate/planner/types";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

export const TOSS_TRAVEL_GOODS_MAX_INTENTS = 3;

/** Long-trip threshold for luggage (conservative). */
export const TOSS_LUGGAGE_MIN_DURATION_DAYS = 7;

/**
 * Selection priority when more than max intents match.
 * Stronger contextual signals first; travel_adapter omitted (no plug SSOT).
 */
const INTENT_PRIORITY: readonly TossTravelGoodsIntent[] = [
  "car_charger",
  "waterproof_pouch",
  "power_bank",
  "luggage",
  // travel_adapter: SSOT exists but generator stays off until plug policy is reliable.
];

/** Compact forms for water/beach/island signals on itinerary titles (not raw user free-text soup). */
const WATER_SIGNAL_COMPACT = [
  "해변",
  "비치",
  "beach",
  "수영",
  "수영장",
  "swim",
  "swimming",
  "워터파크",
  "waterpark",
  "섬",
  "island",
  "리조트",
  "resort",
  "스노클",
  "snorkel",
  "다이빙",
  "diving",
  "해수욕",
  "서핑",
  "surf",
  "선셋비치",
] as const;

export type TossIntentContext = {
  destinationCountryCode: string | null;
  durationDays: number;
  /** Canonical interest values from normalized draft (not free text). */
  interests: readonly string[];
  /** Plan itinerary item titles / areas (normalized context). */
  itineraryTexts: readonly string[];
  /** True only when a Localrent (or other) rental_car offer was actually built. */
  hasRentalCarOffer: boolean;
};

export function collectItineraryTexts(plan: PlannerPlan | null | undefined): string[] {
  if (!plan?.days?.length) return [];
  const out: string[] = [];
  for (const day of plan.days) {
    if (day.title) out.push(day.title);
    if (day.summary) out.push(day.summary);
    for (const item of day.items ?? []) {
      if (item.name) out.push(item.name);
      if (item.area) out.push(item.area);
      if (item.description) out.push(item.description);
      if (item.type) out.push(item.type);
    }
  }
  return out;
}

export function buildTossIntentContext(params: {
  routing: Pick<AffiliateRoutingContext, "destination" | "dates" | "interests">;
  plan: PlannerPlan | null | undefined;
  hasRentalCarOffer: boolean;
}): TossIntentContext {
  return {
    destinationCountryCode: params.routing.destination.countryCode?.toUpperCase() ?? null,
    durationDays: params.routing.dates.durationDays,
    interests: params.routing.interests ?? [],
    itineraryTexts: collectItineraryTexts(params.plan),
    hasRentalCarOffer: params.hasRentalCarOffer,
  };
}

function isOverseas(countryCode: string | null): boolean {
  return !!countryCode && countryCode !== "KR";
}

function hasWaterSignal(ctx: TossIntentContext): boolean {
  const blobs = [
    ...ctx.itineraryTexts.map(compactActivityName),
    ...ctx.interests.map(compactActivityName),
  ];
  return blobs.some((blob) => WATER_SIGNAL_COMPACT.some((signal) => blob.includes(signal)));
}

/**
 * Deterministic travel_goods intents. LLM never picks products.
 * Conservative: skip intents without a safe Planner-context signal.
 */
export function selectTossTravelGoodsIntents(
  ctx: TossIntentContext,
  max = TOSS_TRAVEL_GOODS_MAX_INTENTS,
): TossTravelGoodsIntent[] {
  const selected = new Set<TossTravelGoodsIntent>();

  if (ctx.hasRentalCarOffer) selected.add("car_charger");
  if (hasWaterSignal(ctx)) selected.add("waterproof_pouch");
  if (isOverseas(ctx.destinationCountryCode)) selected.add("power_bank");
  if (ctx.durationDays >= TOSS_LUGGAGE_MIN_DURATION_DAYS) selected.add("luggage");
  // travel_adapter: intentionally not selected (plug/electrical SSOT unavailable).

  const ordered = INTENT_PRIORITY.filter((intent) => selected.has(intent));
  return ordered.slice(0, Math.max(0, max));
}
