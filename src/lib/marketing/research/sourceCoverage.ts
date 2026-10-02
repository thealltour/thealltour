import { detectKoreanOutboundDemandBand } from "@/lib/marketing/research/services/koreanOutboundRelevanceScorer";
import {
  RESEARCH_SOURCE_COVERAGE_SCOPES,
  type ResearchSourceCoverage,
  type ResearchSourceSemantics,
} from "@/lib/marketing/research/types/sourceSemantics";

/** Registry definition (`semantics`) or persisted row (`metadata.semantics`). */
export type ResearchSourceCoverageCarrier =
  | { semantics: ResearchSourceSemantics }
  | { metadata?: Record<string, unknown> | null }
  | null
  | undefined;

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.trim().length > 0);
}

/** Missing or malformed coverage resolves to null, which never produces a fallback. */
export function resolveSourceCoverage(source: ResearchSourceCoverageCarrier): ResearchSourceCoverage | null {
  if (!source) return null;
  const semantics: unknown = "semantics" in source ? source.semantics : source.metadata?.semantics;
  if (!semantics || typeof semantics !== "object") return null;
  const coverage = (semantics as { coverage?: unknown }).coverage;
  if (!coverage || typeof coverage !== "object") return null;
  const { scope, countries, cities } = coverage as Record<string, unknown>;
  if (!(RESEARCH_SOURCE_COVERAGE_SCOPES as readonly unknown[]).includes(scope)) return null;
  if (countries !== undefined && !isStringList(countries)) return null;
  if (cities !== undefined && !isStringList(cities)) return null;
  return {
    scope: scope as ResearchSourceCoverage["scope"],
    ...(countries ? { countries } : {}),
    ...(cities ? { cities } : {}),
  };
}

/**
 * Geography a source's coverage can stand in for: exactly one declared country (`country`)
 * or city (`city`). `global`, `multi_country` and any ambiguous list yield nothing; no value
 * is ever picked out of several.
 */
export function coverageTerminalGeography(coverage: ResearchSourceCoverage | null): string[] {
  if (!coverage) return [];
  switch (coverage.scope) {
    case "country":
      return coverage.countries?.length === 1 ? [coverage.countries[0]!] : [];
    case "city":
      return coverage.cities?.length === 1 ? [coverage.cities[0]!] : [];
    case "global":
    case "multi_country":
      return [];
  }
}

/** Existing place keyword/entity inference over the item's own text; source-level hints are not item evidence. */
function itemNamesDestination(input: { title: string; summary?: string | null; entities?: string[] | null }): boolean {
  return (
    detectKoreanOutboundDemandBand({
      title: input.title,
      summary: input.summary ?? undefined,
      destinations: input.entities ?? undefined,
    }).matchedId !== null
  );
}

export type ResolvedSignalGeography = { geography: string[]; coverageFallbackApplied: boolean };

/**
 * Terminal geography fallback. Precedence: the item's explicit geography, then any
 * destination the item itself names (left unresolved here rather than contradicted),
 * then the source's coverage. Coverage never overrides either of the former.
 */
export function resolveSignalGeography(
  item: { geography?: string[] | null; title: string; summary?: string | null; entities?: string[] | null },
  source: ResearchSourceCoverageCarrier,
): ResolvedSignalGeography {
  const explicit = item.geography ?? [];
  if (explicit.length > 0) return { geography: explicit, coverageFallbackApplied: false };
  const fallback = coverageTerminalGeography(resolveSourceCoverage(source));
  if (fallback.length === 0 || itemNamesDestination(item)) {
    return { geography: explicit, coverageFallbackApplied: false };
  }
  return { geography: fallback, coverageFallbackApplied: true };
}
