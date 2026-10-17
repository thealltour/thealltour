import "server-only";

import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import { affiliateCtaLabel, affiliateDefaultTitle } from "@/lib/affiliate/planner/copy";
import {
  loadAiraloCatalog,
  type AiraloFeedClientDeps,
} from "@/lib/affiliate/planner/providers/airalo/airaloFeedClient";
import { koreanCountryLabelFromIso } from "@/lib/affiliate/planner/countryIdentity";
import {
  airaloPlanCoversTrip,
  normalizeTripDurationDays,
  resolveAiraloPlanDetails,
  selectAiraloOffer,
} from "@/lib/affiliate/planner/providers/airalo/airaloSelector";
import {
  AIRALO_ALLOWED_HOSTS,
  AIRALO_TRAVELPAYOUTS_CAMPAIGN_ID,
  AIRALO_EXCLUDED_COUNTRY_CODES,
  type AiraloOfferRecord,
} from "@/lib/affiliate/planner/providers/airalo/airaloTypes";
import type {
  AffiliateOfferBuild,
  AffiliateOfferEsimMetadata,
  AffiliateRoutingContext,
} from "@/lib/affiliate/planner/types";
import {
  createTravelpayoutsCommerceTarget,
  type CreateTravelpayoutsCommerceTargetInput,
} from "@/lib/affiliate/travelpayouts/commerceService";
import { travelpayoutsSafeLogMeta } from "@/lib/affiliate/travelpayouts/errors";
import { safeHostnameFromUrl } from "@/lib/affiliate/travelpayouts/urlPolicy";

export type AiraloAdapterDeps = AiraloFeedClientDeps & {
  createCommerceTarget?: (
    input: CreateTravelpayoutsCommerceTargetInput,
  ) => ReturnType<typeof createTravelpayoutsCommerceTarget>;
};

export function isAiraloEligible(context: AffiliateRoutingContext): boolean {
  const countryCode = context.destination.countryCode;
  return (
    context.category === "esim" &&
    context.placement === "preparation" &&
    !!countryCode &&
    /^[A-Za-z]{2}$/.test(countryCode) &&
    !AIRALO_EXCLUDED_COUNTRY_CODES.includes(countryCode.toUpperCase())
  );
}

/**
 * Card plan facts for the selected product. Omitted when the plan is known to be shorter
 * than the trip, so the card never pairs a too-short plan with the trip.
 */
function esimMetadataFor(
  record: AiraloOfferRecord,
  tripDurationDays: number | null,
): AffiliateOfferEsimMetadata | null {
  const plan = resolveAiraloPlanDetails(record);
  if (airaloPlanCoversTrip(plan.validityDays, tripDurationDays) === false) return null;
  if (plan.dataLabel == null && plan.validityDays == null) return null;
  return { dataLabel: plan.dataLabel, validityDays: plan.validityDays };
}

export function createAiraloAdapter(deps: AiraloAdapterDeps = {}): AffiliateProviderAdapter {
  return {
    providerId: "airalo",
    isEligible: isAiraloEligible,
    buildOffer: async (context) => buildAiraloOffer(context, deps),
  };
}

export const airaloAdapter = createAiraloAdapter();

async function buildAiraloOffer(
  context: AffiliateRoutingContext,
  deps: AiraloAdapterDeps,
): Promise<AffiliateOfferBuild | null> {
  if (!isAiraloEligible(context)) return null;
  const countryCode = context.destination.countryCode!.toUpperCase();

  const catalog = await loadAiraloCatalog(deps);
  if (!catalog.ok) {
    console.info(
      "[airalo] catalog_unavailable",
      travelpayoutsSafeLogMeta({
        providerId: "airalo",
        errorCode: catalog.errorCode,
      }),
    );
    return null;
  }

  const tripDurationDays = normalizeTripDurationDays(context.dates.durationDays);
  const selected = selectAiraloOffer({
    records: catalog.records,
    countryCode,
    tripDurationDays,
  });
  if (!selected) return null;

  const createCommerce = deps.createCommerceTarget ?? createTravelpayoutsCommerceTarget;
  try {
    const commerce = await createCommerce({
      sourceUrl: selected.sourceUrl,
      providerId: "airalo",
      allowedHosts: [...AIRALO_ALLOWED_HOSTS],
      campaignId: AIRALO_TRAVELPAYOUTS_CAMPAIGN_ID,
    });

    const destinationLabel = context.destination.text;
    // Products are country-wide, so copy names the country ("일본"), not the city ("오사카").
    const copyLabel = koreanCountryLabelFromIso(countryCode) ?? destinationLabel;
    const esim = esimMetadataFor(selected, tripDurationDays);
    return {
      providerId: "airalo",
      category: "esim",
      placement: "preparation",
      title: affiliateDefaultTitle("esim", copyLabel),
      description: `${copyLabel}에서 사용할 eSIM을 확인해 보세요.`,
      ctaLabel: affiliateCtaLabel("esim"),
      destinationLabel,
      targetUrl: commerce.affiliateUrl,
      providerSubId: commerce.providerSubId,
      affiliateNetwork: commerce.affiliateNetwork,
      affiliateCampaignId: commerce.campaignId ?? AIRALO_TRAVELPAYOUTS_CAMPAIGN_ID,
      sourceUrlHost: commerce.sourceUrlHost || safeHostnameFromUrl(selected.sourceUrl),
      ...(esim ? { metadata: { esim } } : {}),
    };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : "commerce_failed";
    console.info(
      "[airalo] commerce_failed",
      travelpayoutsSafeLogMeta({
        providerId: "airalo",
        hostname: safeHostnameFromUrl(selected.sourceUrl),
        errorCode: code,
      }),
    );
    return null;
  }
}
