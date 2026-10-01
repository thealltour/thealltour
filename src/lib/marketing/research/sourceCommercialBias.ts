import { resolveSourceRoleWeights } from "@/lib/marketing/research/portfolio/sourcePortfolioRoles";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import {
  RESEARCH_SOURCE_COMMERCIAL_BIAS_LEVELS,
  type ResearchSourceCommercialBias,
} from "@/lib/marketing/research/types/sourceSemantics";

/**
 * Share of a source's agenda boost (seed above the neutral 0.5) kept under its commercial bias.
 * Applies to the final MM rank seed only; factual credibility, corroboration, composite and
 * Korean outbound never read it.
 */
export const COMMERCIAL_BIAS_AGENDA_SEED_RETENTION: Readonly<Record<ResearchSourceCommercialBias, number>> = {
  none: 1,
  low: 0.9,
  medium: 0.75,
  high: 0.5,
};

const NEUTRAL_AGENDA_SEED = 0.5;

type CommercialBiasCarrier = Pick<ResearchSource, "metadata"> | null | undefined;

/** Unknown bias is unresolved; it must not grant an above-neutral agenda boost. */
export function resolveCommercialBias(source: CommercialBiasCarrier): ResearchSourceCommercialBias | null {
  const semantics: unknown = source?.metadata?.semantics;
  if (!semantics || typeof semantics !== "object") return null;
  const bias = (semantics as { commercialBias?: unknown }).commercialBias;
  return (RESEARCH_SOURCE_COMMERCIAL_BIAS_LEVELS as readonly unknown[]).includes(bias)
    ? (bias as ResearchSourceCommercialBias)
    : null;
}

/** Seeds at or below neutral carry no agenda boost to attenuate and are returned unchanged. */
export function adjustAgendaSeedForCommercialBias(seed: number, bias: ResearchSourceCommercialBias | null): number {
  if (bias === null) return Math.min(seed, NEUTRAL_AGENDA_SEED);
  if (seed <= NEUTRAL_AGENDA_SEED) return seed;
  return NEUTRAL_AGENDA_SEED + (seed - NEUTRAL_AGENDA_SEED) * COMMERCIAL_BIAS_AGENDA_SEED_RETENTION[bias];
}

export type BiasAdjustedAgendaSeed = {
  /** Highest unadjusted seed; equals `aggregateEvidenceSourceRoleWeights(...).agendaSeedWeight`. */
  rawAgendaSeedWeight: number;
  /** Highest per-source adjusted seed; the final MM rank input. */
  biasAdjustedAgendaSeedWeight: number;
  /** Bias of the source that supplied the adjusted seed. */
  commercialBias: ResearchSourceCommercialBias | null;
  seedSourceId: string | null;
};

type EvidenceSource = Pick<ResearchSource, "id" | "sourceType" | "metadata" | "isOfficial" | "authorityLevel">;

/**
 * Each source's seed is attenuated by that same source's bias before the max is taken, so the
 * winning source can differ from the highest raw seed. No evidence falls back to the `other` seed.
 */
export function aggregateBiasAdjustedAgendaSeedWeight(
  sources: ReadonlyArray<EvidenceSource | null | undefined>,
): BiasAdjustedAgendaSeed {
  if (sources.length === 0) {
    const seed = resolveSourceRoleWeights(null).agendaSeedWeight;
    return { rawAgendaSeedWeight: seed, biasAdjustedAgendaSeedWeight: seed, commercialBias: null, seedSourceId: null };
  }
  let raw = 0;
  let best: BiasAdjustedAgendaSeed | null = null;
  for (const source of sources) {
    const seed = resolveSourceRoleWeights(source).agendaSeedWeight;
    const commercialBias = resolveCommercialBias(source);
    const adjusted = adjustAgendaSeedForCommercialBias(seed, commercialBias);
    raw = Math.max(raw, seed);
    if (!best || adjusted > best.biasAdjustedAgendaSeedWeight) {
      best = {
        rawAgendaSeedWeight: 0,
        biasAdjustedAgendaSeedWeight: adjusted,
        commercialBias,
        seedSourceId: source?.id ?? null,
      };
    }
  }
  return { ...best!, rawAgendaSeedWeight: raw };
}
