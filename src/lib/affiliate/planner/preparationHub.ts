import type {
  AffiliateCategory,
  AffiliateOffer,
  PlannerAffiliateOffersDto,
} from "@/lib/affiliate/planner/types";

export type PreparationHubSectionId = "booking" | "local" | "goods";

export type PreparationHubGroups = {
  booking: AffiliateOffer[];
  activities: AffiliateOffer[];
  local: AffiliateOffer[];
  travelGoods: AffiliateOffer[];
};

const BOOKING_CATEGORIES = new Set<AffiliateCategory>(["flight", "hotel"]);
const LOCAL_CATEGORIES = new Set<AffiliateCategory>([
  "esim",
  "rental_car",
  "transfer",
  "insurance",
]);

/** User-facing category chips for CTA summary (not provider names). */
const HUB_LABEL_ORDER = [
  { key: "flight", label: "항공" },
  { key: "hotel", label: "숙소" },
  { key: "activity", label: "티켓·액티비티" },
  { key: "esim", label: "eSIM" },
  { key: "rental_car", label: "렌터카" },
  { key: "transfer", label: "공항 이동" },
  { key: "insurance", label: "여행자보험" },
  { key: "travel_goods", label: "준비물" },
] as const;

function dedupeOffers(offers: AffiliateOffer[]): AffiliateOffer[] {
  const seen = new Set<string>();
  const out: AffiliateOffer[] = [];
  for (const offer of offers) {
    const key = offer.offerId || offer.trackingToken;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(offer);
  }
  return out;
}

/** All day-scoped activity offers (item-attached + unattached), deduped. */
export function collectDayActivityOffers(offers: PlannerAffiliateOffersDto): AffiliateOffer[] {
  const collected: AffiliateOffer[] = [];
  for (const dayOffers of Object.values(offers.days ?? {})) {
    for (const offer of dayOffers) {
      if (offer.category === "activity") collected.push(offer);
    }
  }
  return dedupeOffers(collected);
}

export function hasPreparationHubContent(offers: PlannerAffiliateOffersDto): boolean {
  if (offers.summary.length > 0) return true;
  if (offers.preparation.length > 0) return true;
  if (Object.values(offers.days ?? {}).some((day) => day.length > 0)) return true;
  if (offers.activityDiscovery?.tiqets != null) return true;
  if (offers.activityDiscovery?.klook != null) return true;
  return false;
}

export function groupPreparationHubOffers(
  offers: PlannerAffiliateOffersDto,
): PreparationHubGroups {
  const booking: AffiliateOffer[] = [];
  const local: AffiliateOffer[] = [];
  const travelGoods: AffiliateOffer[] = [];

  for (const offer of [...offers.summary, ...offers.preparation]) {
    if (offer.category === "travel_goods") {
      travelGoods.push(offer);
      continue;
    }
    if (BOOKING_CATEGORIES.has(offer.category)) {
      booking.push(offer);
      continue;
    }
    if (LOCAL_CATEGORIES.has(offer.category)) {
      local.push(offer);
    }
  }

  return {
    booking: dedupeOffers(booking),
    activities: collectDayActivityOffers(offers),
    local: dedupeOffers(local),
    travelGoods: dedupeOffers(travelGoods).slice(0, 3),
  };
}

/** Compact CTA subtitle from available hub categories. */
export function buildPreparationHubSummaryLabel(
  offers: PlannerAffiliateOffersDto,
): string {
  const groups = groupPreparationHubOffers(offers);
  const present = new Set<string>();
  for (const o of groups.booking) present.add(o.category);
  for (const o of groups.local) present.add(o.category);
  if (groups.travelGoods.length > 0) present.add("travel_goods");
  if (
    groups.activities.length > 0 ||
    offers.activityDiscovery?.tiqets != null ||
    offers.activityDiscovery?.klook != null
  ) {
    present.add("activity");
  }

  const labels = HUB_LABEL_ORDER.filter((row) => present.has(row.key)).map((row) => row.label);
  if (labels.length === 0) return "항공 · 숙소 · eSIM · 액티비티 · 준비물";
  if (labels.length <= 3) return labels.join(" · ");
  return `${labels.slice(0, 3).join(" · ")} 외 ${labels.length - 3}개`;
}

export function preparationHubHasSection(
  groups: PreparationHubGroups,
  offers: PlannerAffiliateOffersDto,
  section: PreparationHubSectionId | "activities",
): boolean {
  switch (section) {
    case "booking":
      return groups.booking.length > 0;
    case "local":
      return groups.local.length > 0;
    case "goods":
      return groups.travelGoods.length > 0;
    case "activities":
      return (
        groups.activities.length > 0 ||
        offers.activityDiscovery?.tiqets != null ||
        offers.activityDiscovery?.klook != null
      );
    default:
      return false;
  }
}
