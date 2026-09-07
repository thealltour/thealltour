import "server-only";

import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import { AFFILIATE_DISCLOSURE_KO, affiliateCtaLabel, affiliateDefaultTitle } from "@/lib/affiliate/planner/copy";
import { itemTypeToAffiliateCategory } from "@/lib/affiliate/planner/eligibility";
import { persistAffiliateOfferToken } from "@/lib/affiliate/planner/offerRepository";
import type { AffiliateDestinationOverride } from "@/lib/affiliate/planner/providerConfig";
import {
  getProductionAffiliateAdapters,
  getProductionAffiliateProviderDefinitions,
  getProductionDestinationOverrides,
} from "@/lib/affiliate/planner/registry";
import { routeAffiliateOffer } from "@/lib/affiliate/planner/router";
import type {
  AffiliateCategory,
  AffiliateOffer,
  AffiliatePlacement,
  AffiliateProviderDefinition,
  AffiliateRoutingContext,
  PlannerAffiliateOffersDto,
} from "@/lib/affiliate/planner/types";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import type { PlannerDraftInput } from "@/types/planner";
import { normalizePlannerDraftInput } from "@/lib/planner/normalizeDraftInput";

const SUMMARY_CATEGORIES: AffiliateCategory[] = ["flight", "hotel"];
const PREPARATION_CATEGORIES: AffiliateCategory[] = ["esim", "insurance", "travel_goods"];
const SUMMARY_MAX = 2;
const PREPARATION_MAX = 3;
const DAY_MAX = 1;

export type BuildAffiliateOffersDeps = {
  providers?: AffiliateProviderDefinition[];
  adapters?: Map<string, AffiliateProviderAdapter>;
  overrides?: AffiliateDestinationOverride[];
  persist?: typeof persistAffiliateOfferToken;
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

  const draft = normalizePlannerDraftInput(params.input);
  const destinationText =
    draft?.destination.text?.trim() || params.plan.destination.name || "";

  const baseContext = {
    plannerSessionId: params.sessionId,
    destination: {
      text: destinationText,
      countryCode: null as string | null,
    },
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
  };

  const summary: AffiliateOffer[] = [];
  for (const category of SUMMARY_CATEGORIES) {
    if (summary.length >= SUMMARY_MAX) break;
    const offer = await routeAndPersist({
      context: {
        ...baseContext,
        placement: "planner_summary",
        category,
      },
      providers,
      adapters,
      overrides,
      persist,
      sessionId: params.sessionId,
      destination: destinationText,
      sourceProductId: params.sourceProductId,
    });
    if (offer) summary.push(offer);
  }

  const preparation: AffiliateOffer[] = [];
  for (const category of PREPARATION_CATEGORIES) {
    if (preparation.length >= PREPARATION_MAX) break;
    // eSIM: at most one total (category loop already one per category)
    const offer = await routeAndPersist({
      context: {
        ...baseContext,
        placement: "preparation",
        category,
      },
      providers,
      adapters,
      overrides,
      persist,
      sessionId: params.sessionId,
      destination: destinationText,
      sourceProductId: params.sourceProductId,
    });
    if (offer) preparation.push(offer);
  }

  const days: Record<string, AffiliateOffer[]> = {};
  for (const day of params.plan.days) {
    const dayOffers: AffiliateOffer[] = [];
    for (const item of day.items) {
      if (dayOffers.length >= DAY_MAX) break;
      const mapped = itemTypeToAffiliateCategory(item.type);
      if (!mapped) continue;
      const offer = await routeAndPersist({
        context: {
          ...baseContext,
          placement: "day_item",
          category: mapped,
          dayNumber: day.day,
          itemOrder: item.order,
          itemType: item.type,
          placeName: item.name,
        },
        providers,
        adapters,
        overrides,
        persist,
        sessionId: params.sessionId,
        destination: destinationText,
        sourceProductId: params.sourceProductId,
      });
      if (offer) dayOffers.push(offer);
    }
    if (dayOffers.length > 0) days[String(day.day)] = dayOffers;
  }

  const hasAny =
    summary.length > 0 || preparation.length > 0 || Object.keys(days).length > 0;

  return {
    summary,
    preparation,
    days,
    disclosure: hasAny ? AFFILIATE_DISCLOSURE_KO : null,
  };
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
  const { offer } = routeAffiliateOffer({
    context: params.context,
    providers: params.providers,
    adapters: params.adapters,
    overrides: params.overrides,
  });
  if (!offer) return null;

  // Ensure title/cta defaults if adapter omitted
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
export function routePlacementOffer(params: {
  context: AffiliateRoutingContext;
  providers: AffiliateProviderDefinition[];
  adapters: Map<string, AffiliateProviderAdapter>;
  overrides?: AffiliateDestinationOverride[];
}) {
  return routeAffiliateOffer(params);
}

export type { AffiliatePlacement };
