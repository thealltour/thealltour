import "server-only";

import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import { AFFILIATE_DISCLOSURE_KO, affiliateCtaLabel, affiliateDefaultTitle } from "@/lib/affiliate/planner/copy";
import { resolveAffiliateDestination } from "@/lib/affiliate/planner/destinationResolver";
import {
  selectActivityItemTargets,
  type ActivityItemTarget,
} from "@/lib/affiliate/planner/eligibility";
import { persistAffiliateOfferToken } from "@/lib/affiliate/planner/offerRepository";
import type { AffiliateDestinationOverride } from "@/lib/affiliate/planner/providerConfig";
import {
  getProductionAffiliateAdapters,
  getProductionAffiliateProviderDefinitions,
  getProductionDestinationOverrides,
} from "@/lib/affiliate/planner/registry";
import { resolveAviasalesLocationIata } from "@/lib/affiliate/planner/providers/aviasales/aviasalesDestinationResolver";
import { routeAffiliateOffer } from "@/lib/affiliate/planner/router";
import type {
  AffiliateCategory,
  AffiliateFlightOrigin,
  AffiliateOffer,
  AffiliatePlacement,
  AffiliateProviderDefinition,
  AffiliateRoutingContext,
  PlannerAffiliateOffersDto,
} from "@/lib/affiliate/planner/types";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import type { PlannerDraftInput } from "@/types/planner";
import { normalizePlannerDraftInput } from "@/lib/planner/normalizeDraftInput";
import { mapWithConcurrency } from "@/lib/planner/placesClient";

const SUMMARY_CATEGORIES: AffiliateCategory[] = ["flight", "hotel"];
const PREPARATION_CATEGORIES: AffiliateCategory[] = ["esim", "insurance", "travel_goods"];
const SUMMARY_MAX = 2;
const PREPARATION_MAX = 3;
/** Parallel item-level activity lookups after the first (one wave for the trip cap). */
const ACTIVITY_ROUTE_CONCURRENCY = 5;

export type BuildAffiliateOffersDeps = {
  providers?: AffiliateProviderDefinition[];
  adapters?: Map<string, AffiliateProviderAdapter>;
  overrides?: AffiliateDestinationOverride[];
  persist?: typeof persistAffiliateOfferToken;
  resolveDestination?: typeof resolveAffiliateDestination;
  resolveOriginIata?: typeof resolveAviasalesLocationIata;
};

/**
 * Server-side offer selection for a Planner Result.
 * Returns empty slots when no enabled adapters (PR-8 default).
 */
export async function buildAffiliateOffersForSession(params: {
  sessionId: string;
  plan: PlannerPlan;
  input: PlannerDraftInput | unknown;
  sourceProductId: string | null;
  deps?: BuildAffiliateOffersDeps;
}): Promise<PlannerAffiliateOffersDto> {
  const providers =
    params.deps?.providers ?? getProductionAffiliateProviderDefinitions();
  const adapters = params.deps?.adapters ?? getProductionAffiliateAdapters();
  const overrides = params.deps?.overrides ?? getProductionDestinationOverrides();
  const persist = params.deps?.persist ?? persistAffiliateOfferToken;
  const resolveDestination = params.deps?.resolveDestination ?? resolveAffiliateDestination;
  const resolveOriginIata = params.deps?.resolveOriginIata ?? resolveAviasalesLocationIata;

  const draft = normalizePlannerDraftInput(params.input);
  const destinationText =
    draft?.destination.text?.trim() || params.plan.destination.name || "";

  const destination = await resolveDestination({
    destinationText,
    plan: params.plan,
    input: draft,
  });

  const baseContext = {
    plannerSessionId: params.sessionId,
    destination,
    dates: draft?.dates ?? {
      mode: params.plan.tripOverview.startDate ? ("fixed" as const) : ("flexible" as const),
      startDate: params.plan.tripOverview.startDate,
      endDate: params.plan.tripOverview.endDate,
      durationDays: params.plan.tripOverview.days,
    },
    travelers: draft?.travelers ?? { adults: 1, children: 0 },
    companionType: draft?.companionType ?? "solo",
    interests: draft?.interests ?? [],
    pace: draft?.pace ?? "balanced",
    sourceProductId: params.sourceProductId,
    flightOrigin: null as AffiliateFlightOrigin | null,
  };

  const route = (context: AffiliateRoutingContext) =>
    routeAndPersist({
      context,
      providers,
      adapters,
      overrides,
      persist,
      sessionId: params.sessionId,
      destination: destination.text,
      sourceProductId: params.sourceProductId,
    }).catch(() => null);

  const routeGroup = async (
    categories: AffiliateCategory[],
    placement: AffiliatePlacement,
    max: number,
    flightOrigin: AffiliateFlightOrigin | null = null,
  ): Promise<AffiliateOffer[]> => {
    const out: AffiliateOffer[] = [];
    for (const category of categories) {
      if (out.length >= max) break;
      const offer = await route({ ...baseContext, flightOrigin, placement, category });
      if (offer) out.push(offer);
    }
    return out;
  };

  const routeSummary = async (): Promise<AffiliateOffer[]> => {
    const flightOrigin = await resolveFlightOriginOnce({ draft, providers, resolveOriginIata });
    return routeGroup(SUMMARY_CATEGORIES, "planner_summary", SUMMARY_MAX, flightOrigin);
  };

  const activityTargets = selectActivityItemTargets(params.plan.days);
  const routeActivity = (target: ActivityItemTarget) =>
    route({
      ...baseContext,
      placement: "day_item",
      category: "activity",
      dayNumber: target.dayNumber,
      itemOrder: target.itemOrder,
      itemType: target.itemType,
      placeName: target.placeName,
    });

  // The first lookup runs alone to warm destination-level caches (city, catalog) shared by every
  // item. Results are item-dependent (named activities), so a miss never skips later targets.
  const routeActivities = async (): Promise<Array<AffiliateOffer | null>> => {
    const [first, ...rest] = activityTargets;
    if (!first) return [];
    const firstOffer = await routeActivity(first);
    const restOffers = await mapWithConcurrency(rest, ACTIVITY_ROUTE_CONCURRENCY, routeActivity);
    return [firstOffer, ...restOffers];
  };

  const [summary, preparation, activityOffers] = await Promise.all([
    routeSummary(),
    routeGroup(PREPARATION_CATEGORIES, "preparation", PREPARATION_MAX),
    routeActivities(),
  ]);

  const days: Record<string, AffiliateOffer[]> = {};
  activityTargets.forEach((target, index) => {
    const offer = activityOffers[index];
    if (!offer) return;
    const key = String(target.dayNumber);
    (days[key] ??= []).push(offer);
  });

  const hasAny =
    summary.length > 0 || preparation.length > 0 || Object.keys(days).length > 0;

  return {
    summary,
    preparation,
    days,
    disclosure: hasAny ? AFFILIATE_DISCLOSURE_KO : null,
  };
}

/**
 * Resolve draft.origin.text → flightOrigin once when any enabled flight provider needs it.
 * Failure → null (no flight offer only; WeGoTrip/Airalo unaffected).
 * Never invent Seoul/ICN/SEL/locale/IP defaults.
 */
async function resolveFlightOriginOnce(params: {
  draft: PlannerDraftInput | null;
  providers: AffiliateProviderDefinition[];
  resolveOriginIata: typeof resolveAviasalesLocationIata;
}): Promise<AffiliateFlightOrigin | null> {
  const originText = params.draft?.origin?.text?.trim() ?? "";
  if (!originText) return null;

  const needsFlightOrigin = params.providers.some(
    (p) => p.enabled && p.categories.includes("flight"),
  );
  if (!needsFlightOrigin) return null;

  try {
    const resolved = await params.resolveOriginIata({ locationText: originText });
    if (!resolved?.iata) return null;
    return { text: originText, iata: resolved.iata };
  } catch {
    return null;
  }
}

async function routeAndPersist(params: {
  context: AffiliateRoutingContext;
  providers: AffiliateProviderDefinition[];
  adapters: Map<string, AffiliateProviderAdapter>;
  overrides: AffiliateDestinationOverride[];
  persist: typeof persistAffiliateOfferToken;
  sessionId: string;
  destination: string;
  sourceProductId: string | null;
}): Promise<AffiliateOffer | null> {
  const { offer } = await routeAffiliateOffer({
    context: params.context,
    providers: params.providers,
    adapters: params.adapters,
    overrides: params.overrides,
  });
  if (!offer) return null;

  const build = {
    ...offer,
    title: offer.title || affiliateDefaultTitle(offer.category, offer.destinationLabel),
    ctaLabel: offer.ctaLabel || affiliateCtaLabel(offer.category),
  };

  return params.persist({
    sessionId: params.sessionId,
    build,
    destination: params.destination,
    sourceProductId: params.sourceProductId,
  });
}

/** Pure helper for tests — route without DB. */
export async function routePlacementOffer(params: {
  context: AffiliateRoutingContext;
  providers: AffiliateProviderDefinition[];
  adapters: Map<string, AffiliateProviderAdapter>;
  overrides?: AffiliateDestinationOverride[];
}) {
  return routeAffiliateOffer(params);
}

export type { AffiliatePlacement };
