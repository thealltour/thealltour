import type { AffiliateOffer, PlannerAffiliateOffersDto } from "@/lib/affiliate/planner/types";

/**
 * Item-level offers for one day, keyed by itemOrder.
 * Only offers whose metadata names this exact day and an itemOrder are attached; first offer per item wins.
 */
export function getItemOffersForDay(
  offers: PlannerAffiliateOffersDto,
  dayNumber: number,
): Map<number, AffiliateOffer> {
  const byOrder = new Map<number, AffiliateOffer>();
  for (const offer of offers.days[String(dayNumber)] ?? []) {
    const itemOrder = offer.metadata?.itemOrder;
    if (offer.metadata?.dayNumber !== dayNumber) continue;
    if (typeof itemOrder !== "number" || !Number.isFinite(itemOrder)) continue;
    if (!byOrder.has(itemOrder)) byOrder.set(itemOrder, offer);
  }
  return byOrder;
}

/**
 * Day offers without an itemOrder (rendered below the day section, never on an item).
 * Offers whose metadata names a different day are dropped.
 */
export function getUnattachedDayOffers(
  offers: PlannerAffiliateOffersDto,
  dayNumber: number,
): AffiliateOffer[] {
  return (offers.days[String(dayNumber)] ?? []).filter((offer) => {
    const metaDay = offer.metadata?.dayNumber;
    if (metaDay != null && metaDay !== dayNumber) return false;
    const itemOrder = offer.metadata?.itemOrder;
    return typeof itemOrder !== "number" || !Number.isFinite(itemOrder);
  });
}
