import { describe, expect, it } from "vitest";

import {
  MVP_RESEARCH_SOURCES,
  DEFERRED_RESEARCH_SOURCES_V1,
  UK_GOV_TRAVEL_SOURCE_ID,
  TRAVELTIMES_SOURCE_ID,
  VIETNAM_TRAVEL_SOURCE_ID,
} from "@/lib/marketing/research/collectors/config";
import { resolveSourceRoleWeights } from "@/lib/marketing/research/portfolio/sourcePortfolioRoles";
import { scoreKoreanOutboundRelevance } from "@/lib/marketing/research/services/koreanOutboundRelevanceScorer";
import {
  buildAgendaCandidateFromBrief,
  rankAgendaCandidates,
} from "@/lib/marketing/research/services/agendaCandidateBuilder";
import { computeAgendaPoolRankScore } from "@/lib/marketing/research/services/scoringPolicy";
import type { ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

const NOW = new Date("2026-09-04T00:00:00.000Z");

function brief(partial: Partial<ResearchBrief> & Pick<ResearchBrief, "title" | "summary" | "destinations">): ResearchBrief {
  return {
    id: partial.id ?? "11111111-1111-4111-8111-111111111101",
    title: partial.title,
    summary: partial.summary,
    signalIds: partial.signalIds ?? ["22222222-2222-4222-8222-222222222201"],
    claims: partial.claims ?? [partial.summary],
    evidence: partial.evidence ?? [
      {
        id: "33333333-3333-4333-8333-333333333301",
        sourceId: partial.evidence?.[0]?.sourceId ?? UK_GOV_TRAVEL_SOURCE_ID,
        evidenceType: "official_statement",
        observedAt: NOW.toISOString(),
        excerpt: partial.summary,
        url: "https://example.com/x",
      },
    ],
    topics: partial.topics ?? ["travel", "safety"],
    destinations: partial.destinations,
    entities: partial.entities ?? [],
    freshness: partial.freshness ?? {
      observedAt: NOW.toISOString(),
      publishedAt: NOW.toISOString(),
      freshnessScore: 0.9,
    },
    credibility: partial.credibility ?? {
      score: 0.9,
      level: "high",
      reasons: ["official"],
    },
    travelRelevance: partial.travelRelevance ?? {
      score: 0.85,
      reasons: ["travel_topic_keyword"],
      destinationRelevance: 0.8,
      travelerImpact: 0.8,
      bookingImpact: 0.4,
      marketRelevance: 0.5,
    },
    publicInterest: partial.publicInterest ?? 0.55,
    commercialRelevance: partial.commercialRelevance ?? null,
    corroboration: partial.corroboration ?? {
      score: 0.4,
      sourceDiversityCount: 1,
      independentSourceCount: 1,
      reasons: [],
    },
    risks: partial.risks ?? [],
    openQuestions: partial.openQuestions ?? [],
    generatedAt: NOW.toISOString(),
    status: "active",
  };
}

function sourceById(id: string): ResearchSource {
  const row = MVP_RESEARCH_SOURCES.find((s) => s.id === id)!;
  return { ...row, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() };
}

describe("STEP R-1 source portfolio roles", () => {
  it("FCDO is high evidence authority but low agenda seed / Korean market", () => {
    const weights = resolveSourceRoleWeights(sourceById(UK_GOV_TRAVEL_SOURCE_ID));
    expect(weights.portfolioRole).toBe("safety_verification");
    expect(weights.evidenceAuthorityWeight).toBeGreaterThan(0.9);
    expect(weights.agendaSeedWeight).toBeLessThan(0.3);
    expect(weights.koreanMarketWeight).toBeLessThan(0.35);
  });

  it("Korean editorial source gets strong market/seed contribution", () => {
    const weights = resolveSourceRoleWeights(sourceById(TRAVELTIMES_SOURCE_ID));
    expect(weights.portfolioRole).toBe("korean_travel_editorial");
    expect(weights.agendaSeedWeight).toBeGreaterThan(0.85);
    expect(weights.koreanMarketWeight).toBeGreaterThan(0.9);
  });

  it("authoritative FCDO evidence remains usable even when agendaSeedWeight is low", () => {
    const weights = resolveSourceRoleWeights(sourceById(UK_GOV_TRAVEL_SOURCE_ID));
    expect(weights.evidenceAuthorityWeight).toBeGreaterThan(weights.agendaSeedWeight);
  });

  it("documents deferred sources without inventing unsafe scrapers", () => {
    expect(DEFERRED_RESEARCH_SOURCES_V1.length).toBeGreaterThanOrEqual(3);
    expect(DEFERRED_RESEARCH_SOURCES_V1.some((s) => s.name.includes("외교부"))).toBe(true);
  });
});

describe("STEP R-1 koreanOutboundRelevanceScore", () => {
  it("Japan seasonal travel update ranks above unrelated South Sudan advisory", () => {
    const japan = scoreKoreanOutboundRelevance({
      title: "Japan autumn foliage travel update for Seoul departures",
      summary: "Seasonal Japan travel tips for Korean outbound travelers visiting Kyoto.",
      destinations: ["japan", "kyoto"],
      topics: ["season", "travel"],
      signalTypes: ["destination_trend"],
      seasonalityScore: 0.75,
      sourceRole: resolveSourceRoleWeights(sourceById(TRAVELTIMES_SOURCE_ID)),
    });
    const southSudan = scoreKoreanOutboundRelevance({
      title: "south sudan",
      summary: "Updated information about Ebola (Entry requirements page).",
      destinations: ["south-sudan"],
      topics: ["travel", "visa"],
      signalTypes: ["entry_requirement"],
      sourceRole: resolveSourceRoleWeights(sourceById(UK_GOV_TRAVEL_SOURCE_ID)),
    });
    expect(japan.score).toBeGreaterThan(southSudan.score);
    expect(japan.demandBand).toBe("high");
    expect(southSudan.demandBand).toBe("low");
  });

  it("Vietnam entry/travel update ranks above low-demand distant advisory", () => {
    const vietnam = scoreKoreanOutboundRelevance({
      title: "Vietnam entry requirements update for travelers",
      summary: "Practical entry guidance for visitors flying into Da Nang and Hanoi.",
      destinations: ["vietnam"],
      topics: ["visa", "travel"],
      signalTypes: ["entry_requirement"],
      sourceRole: resolveSourceRoleWeights(sourceById(VIETNAM_TRAVEL_SOURCE_ID)),
    });
    const chad = scoreKoreanOutboundRelevance({
      title: "chad",
      summary: "Updated safety and insurance notes.",
      destinations: ["chad"],
      topics: ["safety"],
      signalTypes: ["safety"],
      sourceRole: resolveSourceRoleWeights(sourceById(UK_GOV_TRAVEL_SOURCE_ID)),
    });
    expect(vietnam.score).toBeGreaterThan(chad.score);
  });

  it("Grand Canyon safety event can remain medium/high when materially useful", () => {
    const canyon = scoreKoreanOutboundRelevance({
      title: "After floods, Grand Canyon opens on a limited basis",
      summary: "What Korean FIT travelers need to know about park access and hotels.",
      destinations: ["grand-canyon", "usa"],
      topics: ["safety", "hotel", "travel"],
      signalTypes: ["safety", "disruption"],
      sourceRole: resolveSourceRoleWeights(MVP_RESEARCH_SOURCES.find((s) => s.name.includes("NYT"))!),
    });
    expect(canyon.demandBand).toBe("high");
    expect(canyon.score).toBeGreaterThanOrEqual(0.55);
  });

  it("low relevance does not destroy factual evidence authority", () => {
    const weights = resolveSourceRoleWeights(sourceById(UK_GOV_TRAVEL_SOURCE_ID));
    const scored = scoreKoreanOutboundRelevance({
      title: "south sudan",
      summary: "Updated Ebola entry requirements.",
      destinations: ["south-sudan"],
      topics: ["visa"],
      signalTypes: ["entry_requirement"],
      sourceRole: weights,
    });
    expect(scored.score).toBeLessThan(0.25);
    expect(weights.evidenceAuthorityWeight).toBeGreaterThan(0.9);
  });

  it("does not silently overload travelRelevanceScore", () => {
    const candidate = buildAgendaCandidateFromBrief(
      brief({
        id: "11111111-1111-4111-8111-111111111199",
        title: "Japan autumn travel update",
        summary: "Seasonal Japan travel guidance.",
        destinations: ["japan"],
        travelRelevance: {
          score: 0.81,
          reasons: ["travel_topic_keyword"],
          destinationRelevance: 0.8,
          travelerImpact: 0.8,
          bookingImpact: 0.4,
          marketRelevance: 0.5,
        },
      }),
      NOW,
      [],
      { evidenceSources: [sourceById(TRAVELTIMES_SOURCE_ID)] },
    );
    expect(candidate.travelRelevanceScore).toBeCloseTo(0.81, 2);
    expect(candidate.koreanOutboundRelevanceScore).toBeGreaterThan(0.5);
    expect(candidate.koreanOutboundRelevanceScore).not.toBe(candidate.travelRelevanceScore);
  });
});

describe("STEP R-1 agenda pool soft ranking", () => {
  it("soft-ranks Japan above South Sudan even if composites are similar", () => {
    const japanBrief = brief({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Japan autumn foliage travel update",
      summary: "Seasonal Japan travel tips for outbound travelers.",
      destinations: ["japan"],
      topics: ["season", "travel"],
      credibility: { score: 0.7, level: "medium", reasons: [] },
      travelRelevance: {
        score: 0.7,
        reasons: [],
        destinationRelevance: 0.7,
        travelerImpact: 0.7,
        bookingImpact: 0.4,
        marketRelevance: 0.7,
      },
    });
    const sudanBrief = brief({
      id: "11111111-1111-4111-8111-111111111112",
      title: "south sudan",
      summary: "Updated information about Ebola.",
      destinations: ["south-sudan"],
      topics: ["visa", "travel"],
      credibility: { score: 0.92, level: "high", reasons: ["official"] },
      travelRelevance: {
        score: 0.8,
        reasons: [],
        destinationRelevance: 0.8,
        travelerImpact: 0.7,
        bookingImpact: 0.3,
        marketRelevance: 0.2,
      },
      evidence: [
        {
          id: "33333333-3333-4333-8333-333333333302",
          sourceId: UK_GOV_TRAVEL_SOURCE_ID,
          evidenceType: "official_statement",
          observedAt: NOW.toISOString(),
          excerpt: "Ebola entry update",
          url: "https://example.com/ss",
        },
      ],
    });

    const japan = buildAgendaCandidateFromBrief(japanBrief, NOW, [], {
      evidenceSources: [sourceById(TRAVELTIMES_SOURCE_ID)],
      signalTypes: ["destination_trend"],
    });
    const sudan = buildAgendaCandidateFromBrief(sudanBrief, NOW, [], {
      evidenceSources: [sourceById(UK_GOV_TRAVEL_SOURCE_ID)],
      signalTypes: ["entry_requirement"],
    });
    sudan.compositeResearchScore = Math.max(sudan.compositeResearchScore, japan.compositeResearchScore + 0.05);

    const ranked = rankAgendaCandidates([sudan, japan], {
      agendaSeedWeightByCandidateId: new Map([
        [japan.id, resolveSourceRoleWeights(sourceById(TRAVELTIMES_SOURCE_ID)).agendaSeedWeight],
        [sudan.id, resolveSourceRoleWeights(sourceById(UK_GOV_TRAVEL_SOURCE_ID)).agendaSeedWeight],
      ]),
    });
    expect(ranked[0]?.title).toContain("Japan");
    expect(
      computeAgendaPoolRankScore({
        compositeResearchScore: japan.compositeResearchScore,
        koreanOutboundRelevanceScore: japan.koreanOutboundRelevanceScore ?? 0,
        agendaSeedWeight: 0.9,
      }),
    ).toBeGreaterThan(
      computeAgendaPoolRankScore({
        compositeResearchScore: sudan.compositeResearchScore,
        koreanOutboundRelevanceScore: sudan.koreanOutboundRelevanceScore ?? 0,
        agendaSeedWeight: 0.18,
      }),
    );
  });
});
