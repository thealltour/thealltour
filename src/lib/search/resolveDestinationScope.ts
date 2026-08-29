/**
 * Shared destination/theme scope resolution for Search (and future Browse 01B-1.1 parity).
 * Uses getSelfAndDescendantIdsAndNames — no DB I/O.
 */

import { getSelfAndDescendantIdsAndNames } from "@/lib/productTaxonomies";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

export type DestinationScope = {
  ids: string[];
  names: string[];
};

export type ThemeScope = {
  matchedName: string;
  names: string[];
};

/** region/destination name → self + descendants (Browse region semantics). */
export function resolveDestinationScope(
  regionName: string,
  destinations: ProductTaxonomy[],
): DestinationScope {
  const name = regionName.trim();
  if (!name) return { ids: [], names: [] };
  return getSelfAndDescendantIdsAndNames(destinations, name);
}

/** theme name → self + descendant names (Browse theme semantics). */
export function resolveThemeScope(themeName: string, themes: ProductTaxonomy[]): ThemeScope {
  const name = themeName.trim();
  if (!name) return { matchedName: "", names: [] };
  const { names } = getSelfAndDescendantIdsAndNames(themes, name);
  return {
    matchedName: name,
    names: names.length > 0 ? names : [name],
  };
}

export function destinationScopesEqual(a: DestinationScope, b: DestinationScope): boolean {
  const sortCopy = (xs: string[]) => [...xs].map((x) => x.trim()).filter(Boolean).sort();
  const ai = sortCopy(a.ids).join("\0");
  const bi = sortCopy(b.ids).join("\0");
  const an = sortCopy(a.names).join("\0");
  const bn = sortCopy(b.names).join("\0");
  return ai === bi && an === bn;
}
