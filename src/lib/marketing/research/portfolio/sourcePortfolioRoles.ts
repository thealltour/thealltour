/**
 * STEP R-1: Source portfolio role weights.
 * Authoritative evidence ≠ high-value agenda seed.
 */

import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

export const RESEARCH_SOURCE_PORTFOLIO_ROLES = [
  "korean_travel_editorial",
  "korean_official_public",
  "destination_official",
  "global_travel_editorial",
  "safety_verification",
  "performance_memory",
  "other",
] as const;

export type ResearchSourcePortfolioRole = (typeof RESEARCH_SOURCE_PORTFOLIO_ROLES)[number];

export type ResearchSourceRoleWeights = {
  portfolioRole: ResearchSourcePortfolioRole;
  /** How strongly this source should seed the agenda slate pool (0–1). */
  agendaSeedWeight: number;
  /** How strongly this source should count as factual evidence (0–1). */
  evidenceAuthorityWeight: number;
  /** How strongly this source reflects Korean outbound traveler demand (0–1). */
  koreanMarketWeight: number;
};

const DEFAULT_BY_TYPE: Record<string, ResearchSourceRoleWeights> = {
  official_government: {
    portfolioRole: "safety_verification",
    agendaSeedWeight: 0.22,
    evidenceAuthorityWeight: 0.95,
    koreanMarketWeight: 0.28,
  },
  tourism_board: {
    portfolioRole: "destination_official",
    agendaSeedWeight: 0.72,
    evidenceAuthorityWeight: 0.88,
    koreanMarketWeight: 0.55,
  },
  news: {
    portfolioRole: "global_travel_editorial",
    agendaSeedWeight: 0.55,
    evidenceAuthorityWeight: 0.55,
    koreanMarketWeight: 0.35,
  },
  travel_industry: {
    portfolioRole: "korean_travel_editorial",
    agendaSeedWeight: 0.88,
    evidenceAuthorityWeight: 0.55,
    koreanMarketWeight: 0.92,
  },
  performance_memory: {
    portfolioRole: "performance_memory",
    agendaSeedWeight: 0.35,
    evidenceAuthorityWeight: 0.4,
    koreanMarketWeight: 0.7,
  },
  other: {
    portfolioRole: "other",
    agendaSeedWeight: 0.4,
    evidenceAuthorityWeight: 0.4,
    koreanMarketWeight: 0.4,
  },
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function readPortfolioBlob(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") return {};
  const portfolio = metadata.portfolio;
  if (portfolio && typeof portfolio === "object" && !Array.isArray(portfolio)) {
    return portfolio as Record<string, unknown>;
  }
  return {};
}

export function resolveSourceRoleWeights(
  source: Pick<ResearchSource, "sourceType" | "metadata" | "isOfficial" | "authorityLevel"> | null | undefined,
): ResearchSourceRoleWeights {
  const fallback =
    DEFAULT_BY_TYPE[source?.sourceType ?? "other"] ?? DEFAULT_BY_TYPE.other!;
  const blob = readPortfolioBlob(source?.metadata ?? null);

  const roleRaw = String(blob.role ?? blob.portfolioRole ?? fallback.portfolioRole);
  const portfolioRole = (RESEARCH_SOURCE_PORTFOLIO_ROLES as readonly string[]).includes(roleRaw)
    ? (roleRaw as ResearchSourcePortfolioRole)
    : fallback.portfolioRole;

  return {
    portfolioRole,
    agendaSeedWeight: clamp01(
      asFiniteNumber(blob.agendaSeedWeight) ?? fallback.agendaSeedWeight,
    ),
    evidenceAuthorityWeight: clamp01(
      asFiniteNumber(blob.evidenceAuthorityWeight) ??
        (source?.isOfficial ? Math.max(fallback.evidenceAuthorityWeight, 0.85) : fallback.evidenceAuthorityWeight),
    ),
    koreanMarketWeight: clamp01(
      asFiniteNumber(blob.koreanMarketWeight) ?? fallback.koreanMarketWeight,
    ),
  };
}

/** Highest agenda-seed / Korean-market / evidence weights across evidence sources. */
export function aggregateEvidenceSourceRoleWeights(
  sources: Array<Pick<ResearchSource, "sourceType" | "metadata" | "isOfficial" | "authorityLevel"> | null | undefined>,
): ResearchSourceRoleWeights {
  if (!sources.length) return DEFAULT_BY_TYPE.other!;
  let agendaSeedWeight = 0;
  let evidenceAuthorityWeight = 0;
  let koreanMarketWeight = 0;
  let portfolioRole: ResearchSourcePortfolioRole = "other";
  let bestSeed = -1;
  for (const source of sources) {
    const weights = resolveSourceRoleWeights(source);
    agendaSeedWeight = Math.max(agendaSeedWeight, weights.agendaSeedWeight);
    evidenceAuthorityWeight = Math.max(evidenceAuthorityWeight, weights.evidenceAuthorityWeight);
    koreanMarketWeight = Math.max(koreanMarketWeight, weights.koreanMarketWeight);
    if (weights.agendaSeedWeight > bestSeed) {
      bestSeed = weights.agendaSeedWeight;
      portfolioRole = weights.portfolioRole;
    }
  }
  return {
    portfolioRole,
    agendaSeedWeight,
    evidenceAuthorityWeight,
    koreanMarketWeight,
  };
}

export function buildSourcePortfolioMetadata(
  weights: ResearchSourceRoleWeights,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...extra,
    portfolio: {
      role: weights.portfolioRole,
      agendaSeedWeight: weights.agendaSeedWeight,
      evidenceAuthorityWeight: weights.evidenceAuthorityWeight,
      koreanMarketWeight: weights.koreanMarketWeight,
    },
  };
}
