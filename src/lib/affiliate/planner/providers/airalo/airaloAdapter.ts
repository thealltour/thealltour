import "server-only";

import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import { affiliateCtaLabel, affiliateDefaultTitle } from "@/lib/affiliate/planner/copy";
import {
  loadAiraloCatalog,
  type AiraloFeedClientDeps,
} from "@/lib/affiliate/planner/providers/airalo/airaloFeedClient";
import { selectAiraloOffer } from "@/lib/affiliate/planner/providers/airalo/airaloSelector";
import {
  AIRALO_ALLOWED_HOSTS,
  AIRALO_DEFAULT_CAMPAIGN_ID,
} from "@/lib/affiliate/planner/providers/airalo/airaloTypes";
import type { AffiliateOfferBuild, AffiliateRoutingContext } from "@/lib/affiliate/planner/types";
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
  return (
    context.category === "esim" &&
    context.placement === "preparation" &&
    !!context.destination.countryCode &&
    /^[A-Za-z]{2}$/.test(context.destination.countryCode)
  );
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

  const selected = selectAiraloOffer({
    records: catalog.records,
    countryCode,
  });
  if (!selected) return null;

  const createCommerce = deps.createCommerceTarget ?? createTravelpayoutsCommerceTarget;
  try {
    const commerce = await createCommerce({
      sourceUrl: selected.sourceUrl,
      providerId: "airalo",
      allowedHosts: [...AIRALO_ALLOWED_HOSTS],
      campaignId: AIRALO_DEFAULT_CAMPAIGN_ID,
    });

    const destinationLabel = context.destination.text;
    return {
      providerId: "airalo",
      category: "esim",
      placement: "preparation",
      title: affiliateDefaultTitle("esim", destinationLabel),
      description: `${destinationLabel}에서 사용할 eSIM을 확인해 보세요.`,
      ctaLabel: affiliateCtaLabel("esim"),
      destinationLabel,
      targetUrl: commerce.affiliateUrl,
      providerSubId: commerce.providerSubId,
      affiliateNetwork: commerce.affiliateNetwork,
      affiliateCampaignId: commerce.campaignId ?? AIRALO_DEFAULT_CAMPAIGN_ID,
      sourceUrlHost: commerce.sourceUrlHost || safeHostnameFromUrl(selected.sourceUrl),
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
