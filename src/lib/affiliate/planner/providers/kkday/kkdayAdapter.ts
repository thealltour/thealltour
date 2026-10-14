import "server-only";

import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import {
  createNamedActivityAdapter,
  type NamedActivityAdapterDeps,
  type NamedActivityProviderSpec,
} from "@/lib/affiliate/planner/namedActivityOffer";
import {
  KKDAY_ALLOWED_HOSTS,
  kkdaySourceUrlFor,
} from "@/lib/affiliate/planner/providers/kkday/kkdaySourceUrl";

export const KKDAY_PROVIDER_SPEC: NamedActivityProviderSpec = {
  providerId: "kkday",
  allowedHosts: KKDAY_ALLOWED_HOSTS,
  sourceUrlFor: kkdaySourceUrlFor,
};

/** Named-activity day_item offers only; unknown places → null (no generic KKday CTA). */
export function createKkdayAdapter(deps: NamedActivityAdapterDeps = {}): AffiliateProviderAdapter {
  return createNamedActivityAdapter(KKDAY_PROVIDER_SPEC, deps);
}

export const kkdayAdapter = createKkdayAdapter();
