import type { AffiliateDestinationOverride } from "@/lib/affiliate/planner/providerConfig";
import type { AffiliateProviderDefinition } from "@/lib/affiliate/planner/types";

/**
 * Sort eligible providers: higher priority first; tie → providerId ascending.
 * Destination overrides may boost priority when present.
 */
export function rankAffiliateProviders(params: {
  definitions: AffiliateProviderDefinition[];
  category: AffiliateProviderDefinition["categories"][number];
  destinationKey: string | null;
  overrides?: AffiliateDestinationOverride[];
}): AffiliateProviderDefinition[] {
  const { definitions, category, destinationKey, overrides = [] } = params;

  return [...definitions].sort((a, b) => {
    const pa = effectivePriority(a, category, destinationKey, overrides);
    const pb = effectivePriority(b, category, destinationKey, overrides);
    if (pb !== pa) return pb - pa;
    return a.id.localeCompare(b.id);
  });
}

function effectivePriority(
  def: AffiliateProviderDefinition,
  category: AffiliateProviderDefinition["categories"][number],
  destinationKey: string | null,
  overrides: AffiliateDestinationOverride[],
): number {
  if (!destinationKey) return def.priority;
  const hit = overrides.find(
    (o) =>
      o.providerId === def.id &&
      o.category === category &&
      o.destinationKey === destinationKey,
  );
  return hit?.priority ?? def.priority;
}
