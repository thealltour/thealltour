import "server-only";

import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import {
  createNamedActivityAdapter,
  type NamedActivityAdapterDeps,
  type NamedActivityProviderSpec,
} from "@/lib/affiliate/planner/namedActivityOffer";
import {
  KLOOK_ALLOWED_HOSTS,
  klookSourceUrlFor,
} from "@/lib/affiliate/planner/providers/klook/klookSourceUrl";

export const KLOOK_PROVIDER_SPEC: NamedActivityProviderSpec = {
  providerId: "klook",
  allowedHosts: KLOOK_ALLOWED_HOSTS,
  sourceUrlFor: klookSourceUrlFor,
};

/** Named-activity day_item offers only; unknown places → null (no generic Klook CTA). */
export function createKlookAdapter(deps: NamedActivityAdapterDeps = {}): AffiliateProviderAdapter {
  return createNamedActivityAdapter(KLOOK_PROVIDER_SPEC, deps);
}

export const klookAdapter = createKlookAdapter();
