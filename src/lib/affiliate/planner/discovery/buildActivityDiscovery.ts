import "server-only";

import { resolveAffiliateCanonicalDestination } from "@/lib/affiliate/planner/destinationCanonical";
import { matchMustDoToPlanItems } from "@/lib/affiliate/planner/discovery/matchMustDoToPlanItems";
import type { PlannerActivityDiscoveryDto } from "@/lib/affiliate/planner/discovery/types";
import { isPlannerTiqetsSuggestEnabled } from "@/lib/affiliate/planner/providerConfig";
import { buildKlookCityWidgetDescriptor } from "@/lib/affiliate/planner/providers/klook/klookDiscovery";
import {
  discoverTiqetsProducts,
  type TiqetsDiscoveryDeps,
} from "@/lib/affiliate/planner/providers/tiqets/tiqetsDiscovery";
import type { AffiliateDestination, AffiliateProviderDefinition } from "@/lib/affiliate/planner/types";
import type { EnvBag } from "@/lib/envBag";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import type { PlannerDraftInput } from "@/types/planner";

export type ActivityDiscoveryDeps = {
  env?: EnvBag;
  tiqets?: TiqetsDiscoveryDeps;
  discoverTiqets?: typeof discoverTiqetsProducts;
};

function isProviderEnabled(providers: AffiliateProviderDefinition[], id: string): boolean {
  return providers.some((p) => p.id === id && p.enabled);
}

/**
 * Activity discovery branch of the Result offers (additive to routed offers).
 * Tiqets: mustDo-driven product widget. Klook: destination city widget. Independent — never fallbacks.
 * Returns null when neither applies. Logs counts only (no mustDo text, queries or titles).
 */
export async function buildActivityDiscovery(params: {
  draft: PlannerDraftInput | null;
  plan: PlannerPlan;
  destination: AffiliateDestination;
  providers: AffiliateProviderDefinition[];
  deps?: ActivityDiscoveryDeps;
}): Promise<PlannerActivityDiscoveryDto | null> {
  const canonical = resolveAffiliateCanonicalDestination(params.destination);
  const mustDo = params.draft?.mustDo ?? [];
  const tiqetsEnabled = isProviderEnabled(params.providers, "tiqets");

  const discoverTiqets = params.deps?.discoverTiqets ?? discoverTiqetsProducts;
  const tiqetsResult =
    tiqetsEnabled && mustDo.length > 0
      ? await discoverTiqets({
          intents: matchMustDoToPlanItems(mustDo, params.plan.days),
          destination: { countryCode: canonical.countryCode, cityEnglish: canonical.cityEnglish },
          suggestEnabled: isPlannerTiqetsSuggestEnabled(params.deps?.env),
          deps: {
            ...params.deps?.tiqets,
            suggestDeps: { env: params.deps?.env, ...params.deps?.tiqets?.suggestDeps },
          },
        })
      : null;

  const klook = buildKlookCityWidgetDescriptor({
    destination: canonical,
    enabled: isProviderEnabled(params.providers, "klook"),
  });

  if (tiqetsResult) {
    console.info("[planner/affiliate/activity_discovery]", {
      ...tiqetsResult.stats,
      tiqetsProductCount: tiqetsResult.descriptor?.products.length ?? 0,
      klookCityResolved: klook != null,
    });
  }

  const tiqets = tiqetsResult?.descriptor ?? null;
  return tiqets || klook ? { tiqets, klook } : null;
}
