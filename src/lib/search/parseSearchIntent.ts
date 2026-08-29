/**
 * Multi-intent Search query parser (Search Query Contract).
 *
 * raw → normalize → full exact → longest phrase (+ spacing variants)
 * → channel synonyms → golf-pattern tokens → strip generic travel terms
 * → structured axes AND / same-axis OR / remainingText AND
 */

import {
  GOLF_PRESET_CATEGORIES,
  isGolfProductLineTaxonomy,
} from "@/lib/products/golfChannel";
import {
  resolveDestinationScope,
  resolveThemeScope,
  type DestinationScope,
} from "@/lib/search/resolveDestinationScope";
import {
  GOLF_SEARCH_SYNONYMS,
  GENERIC_TRAVEL_QUERY_TERMS,
  isPackageTravelSearchSynonym,
  normalizeSearchPhraseForComparison,
  PACKAGE_TRAVEL_SEARCH_SYNONYMS,
} from "@/lib/search/searchQueryVocabulary";
import {
  resolveSearchTaxonomyIntent,
  type SearchTaxonomyContext,
  type SearchTaxonomyIntent,
} from "@/lib/search/resolveSearchTaxonomyIntent";

export { GOLF_SEARCH_SYNONYMS };

export type ParsedSearchIntent = {
  mode: "single" | "structured" | "text-only";
  destinations: Array<DestinationScope & { matchedName: string }>;
  themes: Array<{ matchedName: string; names: string[] }>;
  productLines: Array<{ matchedName: string; ids: string[] }>;
  /** 「패키지여행」/「패키지」 → product_line_id IS NULL */
  unassignedProductLine: boolean;
  golf: NonNullable<SearchTaxonomyIntent["golf"]> | null;
  remainingText: string;
  rawQuery: string;
  /** Flattened single-axis intent for ranking / single-mode text∪taxonomy */
  rankingIntent: SearchTaxonomyIntent;
};

type PhraseKind = "destination" | "theme" | "productLine" | "golf" | "unassignedProductLine";

type PhraseEntry = {
  phrase: string;
  kind: PhraseKind;
  productLineId?: string;
};

function collectGolfProductLineIds(
  productLines: SearchTaxonomyContext["productLines"],
): string[] {
  const ids: string[] = [];
  for (const line of productLines) {
    if (!isGolfProductLineTaxonomy(line)) continue;
    const id = line.id?.trim();
    if (id) ids.push(id);
  }
  return ids;
}

export function buildFullGolfChannel(
  productLines: SearchTaxonomyContext["productLines"],
): NonNullable<SearchTaxonomyIntent["golf"]> {
  return {
    productLineIds: collectGolfProductLineIds(productLines),
    legacyCategories: [...GOLF_PRESET_CATEGORIES],
  };
}

/** Collapse whitespace; trim. */
export function normalizeSearchQuery(q: string): string {
  return q.trim().replace(/\s+/g, " ");
}

/**
 * Whitespace-boundary phrase match (no mid-token substring).
 */
export function findPhraseAtBoundary(haystack: string, phrase: string): number {
  if (!haystack || !phrase) return -1;
  if (haystack === phrase) return 0;
  const padded = ` ${haystack} `;
  const needle = ` ${phrase} `;
  const idx = padded.indexOf(needle);
  if (idx < 0) return -1;
  return idx;
}

function consumePhraseExact(haystack: string, phrase: string): string | null {
  if (haystack === phrase) return "";
  const padded = ` ${haystack} `;
  const needle = ` ${phrase} `;
  const idx = padded.indexOf(needle);
  if (idx < 0) return null;
  const before = padded.slice(0, idx);
  const after = padded.slice(idx + needle.length);
  return normalizeSearchQuery(`${before} ${after}`);
}

/**
 * Exact boundary match, then contiguous-token spacing variant
 * (가족여행 ↔ 가족 여행) without whole-string de-spacing.
 */
export function consumePhraseFlexible(haystack: string, phrase: string): string | null {
  const exact = consumePhraseExact(haystack, phrase);
  if (exact !== null) return exact;

  const target = normalizeSearchPhraseForComparison(phrase);
  if (!target) return null;

  const tokens = haystack.split(" ").filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    let acc = "";
    for (let j = i; j < tokens.length; j++) {
      acc += tokens[j]!;
      if (acc.length > target.length) break;
      if (acc === target) {
        const before = tokens.slice(0, i);
        const after = tokens.slice(j + 1);
        return normalizeSearchQuery([...before, ...after].join(" "));
      }
    }
  }
  return null;
}

/**
 * Strip generic travel domain nouns from remaining text (boundary / spacing-flexible).
 * Does not run mid-token edits.
 */
export function stripGenericTravelTerms(remaining: string): string {
  let r = normalizeSearchQuery(remaining);
  if (!r) return "";

  const terms = [...GENERIC_TRAVEL_QUERY_TERMS].sort(
    (a, b) => b.length - a.length || a.localeCompare(b, "ko"),
  );

  let progressed = true;
  while (progressed && r) {
    progressed = false;
    for (const term of terms) {
      const next = consumePhraseFlexible(r, term);
      if (next === null) continue;
      r = next;
      progressed = true;
      break;
    }
  }
  return r;
}

function buildPhraseInventory(context: SearchTaxonomyContext): PhraseEntry[] {
  const entries: PhraseEntry[] = [];
  const seen = new Set<string>();

  const add = (phrase: string, kind: PhraseKind, productLineId?: string) => {
    const p = phrase.trim();
    if (!p) return;
    const key = `${kind}:${p}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ phrase: p, kind, productLineId });
  };

  const golfSynonymSet = new Set<string>(GOLF_SEARCH_SYNONYMS);

  for (const d of context.destinations) {
    add((d.name ?? "").trim(), "destination");
  }
  for (const t of context.themes) {
    const name = (t.name ?? "").trim();
    if (golfSynonymSet.has(name)) continue;
    add(name, "theme");
  }
  for (const line of context.productLines) {
    const name = (line.name ?? "").trim();
    if (!name) continue;
    if (isPackageTravelSearchSynonym(name)) {
      add(name, "unassignedProductLine");
      continue;
    }
    if (isGolfProductLineTaxonomy(line)) {
      add(name, "golf");
    } else {
      add(name, "productLine", line.id?.trim() || undefined);
    }
  }
  for (const cat of GOLF_PRESET_CATEGORIES) {
    add(cat, "golf");
  }
  // GOLF_SEARCH_SYNONYMS ("골프") intentionally NOT in inventory —
  // handled via contiguous remaining-token golf pattern so "파크 골프" stays one channel.
  for (const syn of PACKAGE_TRAVEL_SEARCH_SYNONYMS) {
    add(syn, "unassignedProductLine");
  }

  entries.sort((a, b) => b.phrase.length - a.phrase.length || a.phrase.localeCompare(b.phrase, "ko"));
  return entries;
}

function flattenRankingIntent(
  parsed: Omit<ParsedSearchIntent, "rankingIntent" | "mode">,
): SearchTaxonomyIntent {
  const intent: SearchTaxonomyIntent = {};
  if (parsed.destinations.length) {
    const ids: string[] = [];
    const names: string[] = [];
    for (const d of parsed.destinations) {
      ids.push(...d.ids);
      names.push(...d.names);
    }
    intent.destination = {
      matchedName: parsed.destinations[0]!.matchedName,
      ids: [...new Set(ids)],
      names: [...new Set(names)],
    };
  }
  if (parsed.themes.length) {
    const names = [...new Set(parsed.themes.flatMap((t) => t.names))];
    intent.theme = {
      matchedName: parsed.themes[0]!.matchedName,
      names,
    };
  }
  if (parsed.productLines.length) {
    intent.productLine = {
      matchedName: parsed.productLines[0]!.matchedName,
      ids: [...new Set(parsed.productLines.flatMap((p) => p.ids))],
    };
  }
  if (parsed.golf) {
    intent.golf = parsed.golf;
  }
  return intent;
}

function axisCount(parts: {
  destinations: unknown[];
  themes: unknown[];
  productLines: unknown[];
  unassignedProductLine: boolean;
  golf: unknown;
}): number {
  let n = 0;
  if (parts.destinations.length) n += 1;
  if (parts.themes.length) n += 1;
  if (parts.productLines.length || parts.unassignedProductLine) n += 1;
  if (parts.golf) n += 1;
  return n;
}

/**
 * Parse q into structured multi-intent or single/text-only modes.
 */
export function parseSearchIntent(
  q: string | null | undefined,
  context: SearchTaxonomyContext,
): ParsedSearchIntent {
  const rawQuery = normalizeSearchQuery(q ?? "");
  const empty: ParsedSearchIntent = {
    mode: "text-only",
    destinations: [],
    themes: [],
    productLines: [],
    unassignedProductLine: false,
    golf: null,
    remainingText: rawQuery,
    rawQuery,
    rankingIntent: {},
  };
  if (!rawQuery) return empty;

  // 1) Full-query exact taxonomy / channel synonym
  const fullExact = resolveSearchTaxonomyIntent(rawQuery, context);
  const hasFullExact = Boolean(
    fullExact.destination || fullExact.theme || fullExact.productLine || fullExact.golf,
  );
  if (hasFullExact) {
    const destinations = fullExact.destination ? [fullExact.destination] : [];
    const themes = fullExact.theme ? [fullExact.theme] : [];
    const productLines = fullExact.productLine ? [fullExact.productLine] : [];
    const golf = fullExact.golf ?? null;
    return {
      mode: "single",
      destinations,
      themes,
      productLines,
      unassignedProductLine: false,
      golf,
      remainingText: "",
      rawQuery,
      rankingIntent: fullExact,
    };
  }

  // Full-query package synonym (패키지 / 패키지여행)
  if (isPackageTravelSearchSynonym(rawQuery)) {
    return {
      mode: "single",
      destinations: [],
      themes: [],
      productLines: [],
      unassignedProductLine: true,
      golf: null,
      remainingText: "",
      rawQuery,
      rankingIntent: {},
    };
  }

  // 2) Longest phrase parsing (+ spacing variants)
  let remaining = rawQuery;
  const destinations: ParsedSearchIntent["destinations"] = [];
  const themes: ParsedSearchIntent["themes"] = [];
  const productLines: ParsedSearchIntent["productLines"] = [];
  let unassignedProductLine = false;
  let golf: ParsedSearchIntent["golf"] = null;
  const matchedDestNames = new Set<string>();
  const matchedThemeNames = new Set<string>();
  const matchedLineIds = new Set<string>();

  const inventory = buildPhraseInventory(context);
  let progressed = true;
  while (progressed && remaining) {
    progressed = false;
    for (const entry of inventory) {
      const next = consumePhraseFlexible(remaining, entry.phrase);
      if (next === null) continue;
      remaining = next;
      progressed = true;

      if (entry.kind === "destination") {
        if (!matchedDestNames.has(entry.phrase)) {
          matchedDestNames.add(entry.phrase);
          const scope = resolveDestinationScope(entry.phrase, context.destinations);
          destinations.push({
            matchedName: entry.phrase,
            ids: scope.ids,
            names: scope.names,
          });
        }
      } else if (entry.kind === "theme") {
        if (!matchedThemeNames.has(entry.phrase)) {
          matchedThemeNames.add(entry.phrase);
          const scope = resolveThemeScope(entry.phrase, context.themes);
          themes.push({
            matchedName: scope.matchedName,
            names: scope.names,
          });
        }
      } else if (entry.kind === "golf") {
        golf = buildFullGolfChannel(context.productLines);
      } else if (entry.kind === "unassignedProductLine") {
        unassignedProductLine = true;
      } else if (entry.kind === "productLine" && entry.productLineId) {
        if (!matchedLineIds.has(entry.productLineId)) {
          matchedLineIds.add(entry.productLineId);
          productLines.push({
            matchedName: entry.phrase,
            ids: [entry.productLineId],
          });
        }
      }
      break;
    }
  }

  // Remaining tokens → golf pattern (파크골프 / 파크 골프 contiguous)
  if (remaining) {
    const tokens = remaining.split(" ").filter(Boolean);
    const kept: string[] = [];
    let i = 0;
    while (i < tokens.length) {
      let matched = false;
      const maxLen = Math.min(4, tokens.length - i);
      for (let len = maxLen; len >= 1; len--) {
        const slice = tokens.slice(i, i + len);
        const compact = slice.join("");
        const spaced = slice.join(" ");
        if (compact.length < 2) continue;
        if (
          isGolfProductLineTaxonomy({ name: compact }) ||
          isGolfProductLineTaxonomy({ name: spaced })
        ) {
          golf = buildFullGolfChannel(context.productLines);
          i += len;
          matched = true;
          break;
        }
      }
      if (!matched) {
        kept.push(tokens[i]!);
        i += 1;
      }
    }
    remaining = normalizeSearchQuery(kept.join(" "));
  }

  const parts = { destinations, themes, productLines, unassignedProductLine, golf };
  const axes = axisCount(parts);

  // 3) Generic travel wording strip (context-aware)
  if (axes > 0) {
    remaining = stripGenericTravelTerms(remaining);
  } else {
    const soft = stripGenericTravelTerms(rawQuery);
    // 온천 여행 → 온천; 여행 alone → keep "여행"
    if (soft.length > 0) {
      remaining = soft;
    } else {
      remaining = rawQuery;
    }
  }

  const base = {
    destinations,
    themes,
    productLines,
    unassignedProductLine,
    golf,
    remainingText: remaining,
    rawQuery,
  };
  const rankingIntent = flattenRankingIntent(base);

  if (axes === 0) {
    return {
      ...base,
      mode: "text-only",
      rankingIntent: {},
    };
  }

  if (axes === 1 && !remaining) {
    return {
      ...base,
      mode: "single",
      rankingIntent,
    };
  }

  return {
    ...base,
    mode: "structured",
    rankingIntent,
  };
}
