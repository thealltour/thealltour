import "server-only";

import { TravelpayoutsError, travelpayoutsSafeLogMeta } from "@/lib/affiliate/travelpayouts/errors";
import { createTravelpayoutsPartnerLink } from "@/lib/affiliate/travelpayouts/partnerLinksClient";
import { createTravelpayoutsSubId } from "@/lib/affiliate/travelpayouts/subId";
import {
  safeHostnameFromUrl,
  validateAffiliateSourceUrl,
} from "@/lib/affiliate/travelpayouts/urlPolicy";

export type CreateTravelpayoutsCommerceTargetInput = {
  sourceUrl: string;
  providerId: string;
  /** Internal tracking token — used only for logging correlation, never as SubID. */
  trackingToken?: string | null;
  allowedHosts?: string[];
  campaignId?: string | null;
  /** Test injection. */
  createPartnerLink?: typeof createTravelpayoutsPartnerLink;
  createSubId?: () => string;
};

export type TravelpayoutsCommerceTarget = {
  affiliateUrl: string;
  providerSubId: string;
  affiliateNetwork: "travelpayouts";
  campaignId?: string;
  sourceUrlHost: string;
};

/**
 * Provider adapters call this after choosing a brand source URL.
 * Does not write DB — offer repository persists the result.
 */
export async function createTravelpayoutsCommerceTarget(
  input: CreateTravelpayoutsCommerceTargetInput,
): Promise<TravelpayoutsCommerceTarget> {
  const sourceCheck = validateAffiliateSourceUrl(input.sourceUrl, {
    allowedHosts: input.allowedHosts,
    httpsOnly: true,
  });
  if (!sourceCheck.ok) {
    console.info(
      "[travelpayouts] commerce invalid_source",
      travelpayoutsSafeLogMeta({
        providerId: input.providerId,
        hostname: safeHostnameFromUrl(input.sourceUrl),
        errorCode: sourceCheck.error.code,
      }),
    );
    throw sourceCheck.error;
  }

  const createSubId = input.createSubId ?? createTravelpayoutsSubId;
  const createPartnerLink = input.createPartnerLink ?? createTravelpayoutsPartnerLink;
  const providerSubId = createSubId();

  try {
    const result = await createPartnerLink({
      targetUrl: sourceCheck.url.toString(),
      subId: providerSubId,
      allowedHosts: input.allowedHosts,
    });

    return {
      affiliateUrl: result.affiliateUrl,
      providerSubId,
      affiliateNetwork: "travelpayouts",
      campaignId: input.campaignId?.trim() || undefined,
      sourceUrlHost: result.hostname,
    };
  } catch (error) {
    const code = error instanceof TravelpayoutsError ? error.code : "network_failed";
    console.info(
      "[travelpayouts] commerce failed",
      travelpayoutsSafeLogMeta({
        providerId: input.providerId,
        hostname: sourceCheck.hostname,
        errorCode: code,
      }),
    );
    throw error;
  }
}
