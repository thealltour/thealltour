import "server-only";

import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import { AFFILIATE_NAMED_ACTIVITY_DESCRIPTION, affiliateCtaLabel } from "@/lib/affiliate/planner/copy";
import {
  resolveNamedActivity,
  type NamedActivity,
  type NamedActivityId,
} from "@/lib/affiliate/planner/namedActivityCatalog";
import type {
  AffiliateOfferBuild,
  AffiliateProviderId,
  AffiliateRoutingContext,
} from "@/lib/affiliate/planner/types";
import {
  createTravelpayoutsCommerceTarget,
  type CreateTravelpayoutsCommerceTargetInput,
} from "@/lib/affiliate/travelpayouts/commerceService";
import { travelpayoutsSafeLogMeta } from "@/lib/affiliate/travelpayouts/errors";
import { safeHostnameFromUrl } from "@/lib/affiliate/travelpayouts/urlPolicy";

export type NamedActivityProviderSpec = {
  providerId: AffiliateProviderId;
  allowedHosts: readonly string[];
  /** Static brand source URL for a canonical activity, or null when the provider has none. */
  sourceUrlFor: (id: NamedActivityId) => string | null;
};

export type NamedActivityAdapterDeps = {
  createCommerceTarget?: (
    input: CreateTravelpayoutsCommerceTargetInput,
  ) => ReturnType<typeof createTravelpayoutsCommerceTarget>;
};

/**
 * Brand source URLs go to Partner Links as-is, so they must be clean: https, an exact allowlisted
 * host, no credentials, no query (other networks' aid/cid/aff_* params) and no fragment.
 */
export function cleanNamedActivitySourceUrl(
  raw: string | undefined,
  allowedHosts: readonly string[],
): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (!allowedHosts.includes(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function resolveNamedActivitySource(
  spec: NamedActivityProviderSpec,
  context: AffiliateRoutingContext,
): { activity: NamedActivity; sourceUrl: string } | null {
  if (context.category !== "activity" || context.placement !== "day_item") return null;
  if (!context.placeName?.trim()) return null;
  const activity = resolveNamedActivity({
    placeName: context.placeName,
    destination: context.destination,
  });
  if (!activity) return null;
  const sourceUrl = spec.sourceUrlFor(activity.id);
  return sourceUrl ? { activity, sourceUrl } : null;
}

export function createNamedActivityAdapter(
  spec: NamedActivityProviderSpec,
  deps: NamedActivityAdapterDeps = {},
): AffiliateProviderAdapter {
  return {
    providerId: spec.providerId,
    isEligible: (context) => resolveNamedActivitySource(spec, context) !== null,
    buildOffer: async (context) => buildNamedActivityOffer(spec, context, deps),
  };
}

async function buildNamedActivityOffer(
  spec: NamedActivityProviderSpec,
  context: AffiliateRoutingContext,
  deps: NamedActivityAdapterDeps,
): Promise<AffiliateOfferBuild | null> {
  const resolved = resolveNamedActivitySource(spec, context);
  if (!resolved) return null;
  const { activity, sourceUrl } = resolved;

  const createCommerce = deps.createCommerceTarget ?? createTravelpayoutsCommerceTarget;
  try {
    const commerce = await createCommerce({
      sourceUrl,
      providerId: spec.providerId,
      allowedHosts: [...spec.allowedHosts],
    });
    return {
      providerId: spec.providerId,
      category: "activity",
      placement: "day_item",
      title: activity.titleKo,
      description: AFFILIATE_NAMED_ACTIVITY_DESCRIPTION,
      ctaLabel: affiliateCtaLabel("activity"),
      destinationLabel: context.destination.text,
      targetUrl: commerce.affiliateUrl,
      dayNumber: context.dayNumber ?? null,
      itemOrder: context.itemOrder ?? null,
      providerSubId: commerce.providerSubId,
      affiliateNetwork: commerce.affiliateNetwork,
      affiliateCampaignId: commerce.campaignId ?? null,
      sourceUrlHost: commerce.sourceUrlHost || safeHostnameFromUrl(sourceUrl),
    };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : "commerce_failed";
    console.info(
      `[${spec.providerId}] commerce_failed`,
      travelpayoutsSafeLogMeta({
        providerId: spec.providerId,
        hostname: safeHostnameFromUrl(sourceUrl),
        errorCode: code,
      }),
    );
    return null;
  }
}
