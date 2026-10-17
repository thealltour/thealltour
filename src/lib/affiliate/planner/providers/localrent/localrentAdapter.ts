import "server-only";

import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import { affiliateCtaLabel, affiliateDefaultTitle } from "@/lib/affiliate/planner/copy";
import { buildLocalrentDeepLink } from "@/lib/affiliate/planner/providers/localrent/localrentDeepLink";
import { resolveLocalrentDestination } from "@/lib/affiliate/planner/providers/localrent/localrentDestinationResolver";
import {
  LOCALRENT_ALLOWED_HOSTS,
  LOCALRENT_EXCLUDED_COUNTRY_CODES,
  LOCALRENT_TRAVELPAYOUTS_CAMPAIGN_ID,
} from "@/lib/affiliate/planner/providers/localrent/localrentDestinations";
import type { AffiliateOfferBuild, AffiliateRoutingContext } from "@/lib/affiliate/planner/types";
import {
  createTravelpayoutsCommerceTarget,
  type CreateTravelpayoutsCommerceTargetInput,
} from "@/lib/affiliate/travelpayouts/commerceService";
import { travelpayoutsSafeLogMeta } from "@/lib/affiliate/travelpayouts/errors";
import { safeHostnameFromUrl } from "@/lib/affiliate/travelpayouts/urlPolicy";

export const LOCALRENT_RENTAL_CAR_DESCRIPTION = "여행 일정에 맞는 렌터카를 확인해 보세요.";

export type LocalrentAdapterDeps = {
  createCommerceTarget?: (
    input: CreateTravelpayoutsCommerceTargetInput,
  ) => ReturnType<typeof createTravelpayoutsCommerceTarget>;
};

/** Cheap gate: fixed overseas trip with both dates; city support is checked in buildOffer. */
export function isLocalrentEligible(context: AffiliateRoutingContext): boolean {
  const countryCode = context.destination.countryCode?.toUpperCase() ?? null;
  return (
    context.category === "rental_car" &&
    context.placement === "preparation" &&
    context.dates.mode === "fixed" &&
    !!context.dates.startDate &&
    !!context.dates.endDate &&
    !!countryCode &&
    !LOCALRENT_EXCLUDED_COUNTRY_CODES.includes(countryCode)
  );
}

export function createLocalrentAdapter(deps: LocalrentAdapterDeps = {}): AffiliateProviderAdapter {
  return {
    providerId: "localrent",
    isEligible: isLocalrentEligible,
    buildOffer: (context) => buildLocalrentOffer(context, deps),
  };
}

export const localrentAdapter = createLocalrentAdapter();

function logSkipped(errorCode: string): null {
  console.info(
    "[localrent] offer_skipped",
    travelpayoutsSafeLogMeta({ providerId: "localrent", errorCode }),
  );
  return null;
}

async function buildLocalrentOffer(
  context: AffiliateRoutingContext,
  deps: LocalrentAdapterDeps,
): Promise<AffiliateOfferBuild | null> {
  if (!isLocalrentEligible(context)) return null;

  const resolved = resolveLocalrentDestination(context.destination);
  if (!resolved.ok) return logSkipped(resolved.reason);

  const sourceUrl = buildLocalrentDeepLink({
    destination: resolved.destination,
    pickupDate: context.dates.startDate,
    dropoffDate: context.dates.endDate,
  });
  if (!sourceUrl) return logSkipped("invalid_dates");

  const createCommerce = deps.createCommerceTarget ?? createTravelpayoutsCommerceTarget;
  try {
    const commerce = await createCommerce({
      sourceUrl,
      providerId: "localrent",
      allowedHosts: [...LOCALRENT_ALLOWED_HOSTS],
      campaignId: LOCALRENT_TRAVELPAYOUTS_CAMPAIGN_ID,
    });

    return {
      providerId: "localrent",
      category: "rental_car",
      placement: "preparation",
      title: affiliateDefaultTitle("rental_car", resolved.destination.labelKo),
      description: LOCALRENT_RENTAL_CAR_DESCRIPTION,
      ctaLabel: affiliateCtaLabel("rental_car"),
      destinationLabel: context.destination.text,
      targetUrl: commerce.affiliateUrl,
      providerSubId: commerce.providerSubId,
      affiliateNetwork: commerce.affiliateNetwork,
      affiliateCampaignId: commerce.campaignId ?? LOCALRENT_TRAVELPAYOUTS_CAMPAIGN_ID,
      sourceUrlHost: commerce.sourceUrlHost || safeHostnameFromUrl(sourceUrl),
    };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : "commerce_failed";
    console.info(
      "[localrent] commerce_failed",
      travelpayoutsSafeLogMeta({
        providerId: "localrent",
        hostname: safeHostnameFromUrl(sourceUrl),
        errorCode: code,
      }),
    );
    return null;
  }
}
