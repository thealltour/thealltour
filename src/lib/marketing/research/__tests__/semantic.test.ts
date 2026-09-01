import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createDeterministicEmbeddingProvider,
  semanticTextFor,
  signalFixture,
} from "@/lib/marketing/research/__tests__/semanticCalibrationFixtures";
import { MVP_RESEARCH_SOURCES } from "@/lib/marketing/research/collectors/config";
import {
  buildAgendaCandidateFromBrief,
  buildResearchScoreComponents,
  rankAgendaCandidates,
} from "@/lib/marketing/research/services/agendaCandidateBuilder";
import { buildResearchBriefFromCluster } from "@/lib/marketing/research/services/briefBuilder";
import { scoreCorroboration } from "@/lib/marketing/research/services/corroborationScorer";
import { cosineSimilarity } from "@/lib/marketing/research/services/cosineSimilarity";
import { buildSemanticResearchText } from "@/lib/marketing/research/services/semanticText";
import { areSignalTypesSemanticallyCompatible } from "@/lib/marketing/research/services/signalTypeCompatibility";
import {
  enumerateSemanticCandidatePairs,
  isSemanticComparisonEligible,
  passesSemanticMergeGuards,
} from "@/lib/marketing/research/services/semanticPrefilter";
import { runSemanticDedup } from "@/lib/marketing/research/services/semanticDeduplicator";
import { buildClustersFromMergeGroups } from "@/lib/marketing/research/services/researchCluster";
import {
  computeCompositeResearchScore,
} from "@/lib/marketing/research/services/scoringPolicy";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

const SOURCES = new Map<string, ResearchSource>(
  MVP_RESEARCH_SOURCES.map((s) => [s.id, { ...s, createdAt: "2026-09-02T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z" }]),
);

describe("semantic dedup L3 and scoring calibration", () => {
  it("builds deterministic semantic text", () => {
    const a = signalFixture({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
      title: " Thailand Entry Update ",
      summary: "Thailand updates entry requirements for travelers.",
      signalType: "entry_requirement",
    });
    const text = buildSemanticResearchText(a);
    expect(text).toContain("type:entry_requirement");
    expect(text).toContain("title:thailand entry update");
    expect(text).toContain("dest:thailand");
  });

  it("merges same-event paraphrase across sources", async () => {
    const official = signalFixture({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
      title: "Thailand updates entry requirements for travelers",
      summary: "Thailand updates entry requirements for travelers.",
      signalType: "entry_requirement",
      sourceId: MVP_RESEARCH_SOURCES[0]!.id,
      sourceType: "official_government",
    });
    const news = signalFixture({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      title: "New Thailand arrival rules announced for foreign visitors",
      summary: "New Thailand arrival rules announced for foreign visitors.",
      signalType: "entry_requirement",
      sourceId: MVP_RESEARCH_SOURCES[1]!.id,
      sourceType: "news",
      rawFingerprint: "news-raw",
      normalizedFingerprint: "news-norm",
    });

    const provider = createDeterministicEmbeddingProvider();
    provider.pinSimilar(semanticTextFor(official), semanticTextFor(news));

    const result = await runSemanticDedup({
      signals: [official, news],
      sources: SOURCES,
      provider,
    });

    expect(result.metrics.merges).toBeGreaterThanOrEqual(1);
    expect(result.duplicates).toHaveLength(1);
    expect(result.unique).toHaveLength(1);
  });

  it("does not merge same destination different events", async () => {
    const policy = signalFixture({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02",
      title: "Thailand entry requirements changed",
      summary: "Thailand entry requirements changed for foreign visitors.",
      signalType: "entry_requirement",
    });
    const tourism = signalFixture({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
      title: "Thailand tourism arrivals hit record high",
      summary: "Thailand tourism arrivals hit record high this quarter.",
      signalType: "destination_trend",
      rawFingerprint: "tourism-raw",
      normalizedFingerprint: "tourism-norm",
    });

    expect(isSemanticComparisonEligible(policy, tourism)).toBe(false);

    const result = await runSemanticDedup({
      signals: [policy, tourism],
      sources: SOURCES,
      provider: createDeterministicEmbeddingProvider(),
    });
    expect(result.duplicates).toHaveLength(0);
  });

  it("blocks destination-only overlap without compatible signal types", () => {
    const weather = signalFixture({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03",
      title: "Okinawa typhoon warning",
      summary: "Storm approaching Okinawa within 24 hours.",
      signalType: "weather",
      destinations: ["okinawa"],
      topics: ["weather"],
    });
    const fare = signalFixture({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3",
      title: "Okinawa airfare sale",
      summary: "Airfare sale for Okinawa routes this week.",
      signalType: "airfare",
      destinations: ["okinawa"],
      topics: ["flight"],
      rawFingerprint: "fare-raw",
      normalizedFingerprint: "fare-norm",
    });

    expect(areSignalTypesSemanticallyCompatible(weather.signalType, fare.signalType)).toBe(false);
    expect(isSemanticComparisonEligible(weather, fare)).toBe(false);
  });

  it("protects temporal mismatch for festivals in different years", () => {
    const a = signalFixture({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04",
      title: "Sapporo Snow Festival 2025",
      summary: "Festival schedule for February 2025.",
      signalType: "festival",
      publishedAt: "2025-08-01T00:00:00.000Z",
    });
    const b = signalFixture({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4",
      title: "Sapporo Snow Festival 2026",
      summary: "Festival schedule for February 2026.",
      signalType: "festival",
      publishedAt: "2026-08-01T00:00:00.000Z",
      rawFingerprint: "fest-raw",
      normalizedFingerprint: "fest-norm",
    });

    const guard = passesSemanticMergeGuards(a, b, 72);
    expect(guard.ok).toBe(false);
    expect(guard.reasons).toContain("year_mismatch");
  });

  it("selects official source as primary in cluster brief", () => {
    const official = signalFixture({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05",
      title: "Kenya travel advisory update",
      summary: "Official Kenya travel advisory update.",
      signalType: "safety",
      sourceId: MVP_RESEARCH_SOURCES[0]!.id,
      sourceType: "official_government",
      destinations: ["kenya"],
    });
    const news = signalFixture({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5",
      title: "Kenya travel advisory update",
      summary: "News repost of Kenya advisory.",
      signalType: "safety",
      sourceId: MVP_RESEARCH_SOURCES[1]!.id,
      sourceType: "news",
      destinations: ["kenya"],
      duplicateOfSignalId: official.id,
      status: "duplicate",
      rawFingerprint: "news-kenya",
      normalizedFingerprint: "news-kenya-n",
    });

    const cluster = buildClustersFromMergeGroups({
      signals: [official, news],
      mergeGroups: [[official.id, news.id]],
      sources: SOURCES,
    })[0]!;

    const brief = buildResearchBriefFromCluster({
      cluster,
      signals: [official, news],
      sources: SOURCES,
    })!;

    expect(brief.primarySignalId).toBe(official.id);
    expect(brief.evidence.length).toBe(2);
    expect(brief.corroboration?.sourceDiversityCount).toBe(2);
  });

  it("increases corroboration for official + news but penalizes syndicated families", () => {
    const official = signalFixture({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06",
      title: "Taiwan entry update",
      summary: "Taiwan entry update.",
      signalType: "entry_requirement",
      sourceId: MVP_RESEARCH_SOURCES[0]!.id,
      sourceType: "official_government",
    });
    const news = signalFixture({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6",
      title: "Taiwan entry update news",
      summary: "Taiwan entry update news.",
      signalType: "entry_requirement",
      sourceId: MVP_RESEARCH_SOURCES[1]!.id,
      sourceType: "news",
      rawFingerprint: "n1",
      normalizedFingerprint: "n1n",
    });

    const mixed = scoreCorroboration({ clusterSignals: [official, news], sources: SOURCES });
    expect(mixed.score).toBeGreaterThan(0.5);
    expect(mixed.reasons).toContain("official_plus_news_corroboration");
  });

  it("falls back when embedding provider unavailable", async () => {
    const a = signalFixture({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa07",
      title: "Indonesia advisory",
      summary: "Indonesia advisory.",
      signalType: "safety",
    });
    const b = signalFixture({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7",
      title: "Indonesia advisory news",
      summary: "Indonesia advisory news.",
      signalType: "safety",
      rawFingerprint: "indo-news",
      normalizedFingerprint: "indo-news-n",
    });
    const result = await runSemanticDedup({
      signals: [a, b],
      sources: SOURCES,
      provider: null,
    });
    expect(result.metrics.status).toBe("skipped");
    expect(result.metrics.statusReason).toBe("embedding_provider_unavailable");
    expect(result.unique).toHaveLength(2);
  });

  it("prefilter reduces candidate comparisons", () => {
    const signals = [
      signalFixture({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08",
        title: "Japan visa",
        summary: "Japan visa update.",
        signalType: "visa",
        destinations: ["japan"],
      }),
      signalFixture({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8",
        title: "Spain travel tips",
        summary: "Spain travel tips.",
        signalType: "general_travel_news",
        destinations: ["spain"],
        rawFingerprint: "spain",
        normalizedFingerprint: "spain-n",
      }),
      signalFixture({
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc8",
        title: "Japan visa news",
        summary: "Japan visa news.",
        signalType: "visa",
        destinations: ["japan"],
        rawFingerprint: "japan2",
        normalizedFingerprint: "japan2-n",
      }),
    ];
    const pairs = enumerateSemanticCandidatePairs(signals);
    expect(pairs.length).toBe(1);
  });

  it("ranks productless high-value topic above low-value commercial signal", () => {
    const urgent = buildResearchBriefFromCluster({
      cluster: {
        id: "11111111-1111-4111-8111-111111111118",
        primarySignalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa09",
        signalIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa09"],
        clusterType: "destination_group",
        createdAt: "2026-09-02T00:00:00.000Z",
        updatedAt: "2026-09-02T00:00:00.000Z",
      },
      signals: [
        signalFixture({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa09",
          title: "Urgent travel restriction for Kenya",
          summary: "Official urgent travel restriction issued.",
          signalType: "safety",
          destinations: ["kenya"],
        }),
      ],
      sources: SOURCES,
    })!;

    const commercial = buildResearchBriefFromCluster({
      cluster: {
        id: "22222222-2222-4222-8222-222222222228",
        primarySignalId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9",
        signalIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9"],
        clusterType: "destination_group",
        createdAt: "2026-09-02T00:00:00.000Z",
        updatedAt: "2026-09-02T00:00:00.000Z",
      },
      signals: [
        signalFixture({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9",
          title: "Old package promo",
          summary: "Low interest package promo.",
          signalType: "internal_product",
          destinations: ["spain"],
          commercialRelevance: { level: "high", matchedProductIds: ["prod-1"], confidence: 0.9 },
          freshness: { observedAt: "2026-09-02T00:00:00.000Z", freshnessScore: 0.2 },
          travelRelevance: { score: 0.4, reasons: [] },
          publicInterestScore: 0.3,
          credibility: { score: 0.5, level: "medium", reasons: [] },
        }),
      ],
      sources: SOURCES,
    })!;

    const ranked = rankAgendaCandidates([
      buildAgendaCandidateFromBrief(commercial),
      buildAgendaCandidateFromBrief(urgent),
    ]);

    expect(ranked[0]!.title).toContain("Kenya");
    expect(ranked[0]!.compositeResearchScore).toBeGreaterThan(ranked[1]!.compositeResearchScore);
  });

  it("applies duplicate novelty penalty within cycle", () => {
    const briefA = buildResearchBriefFromCluster({
      cluster: {
        id: "11111111-1111-4111-8111-111111111119",
        primarySignalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10",
        signalIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10"],
        clusterType: "destination_group",
        createdAt: "2026-09-02T00:00:00.000Z",
        updatedAt: "2026-09-02T00:00:00.000Z",
      },
      signals: [
        signalFixture({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10",
          title: "Japan visa update",
          summary: "Japan visa update.",
          signalType: "visa",
          destinations: ["japan"],
          topics: ["visa", "travel"],
        }),
      ],
      sources: SOURCES,
    })!;

    const briefB = buildResearchBriefFromCluster({
      cluster: {
        id: "22222222-2222-4222-8222-222222222229",
        primarySignalId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba0",
        signalIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba0"],
        clusterType: "destination_group",
        createdAt: "2026-09-02T00:00:00.000Z",
        updatedAt: "2026-09-02T00:00:00.000Z",
      },
      signals: [
        signalFixture({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba0",
          title: "Japan visa follow-up",
          summary: "Japan visa follow-up.",
          signalType: "visa",
          destinations: ["japan"],
          topics: ["visa", "travel"],
          rawFingerprint: "j2",
          normalizedFingerprint: "j2n",
        }),
      ],
      sources: SOURCES,
    })!;

    const first = buildAgendaCandidateFromBrief(briefA, new Date(), []);
    const second = buildAgendaCandidateFromBrief(briefB, new Date(), [briefA, briefA]);
    expect(second.compositeResearchScore).toBeLessThan(first.compositeResearchScore);
    expect(second.riskFlags).toContain("topic_repetition");
  });

  it("keeps composite score deterministic and normalized", () => {
    const brief = buildResearchBriefFromCluster({
      cluster: {
        id: "11111111-1111-4111-8111-11111111111a",
        primarySignalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11",
        signalIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11"],
        clusterType: "destination_group",
        createdAt: "2026-09-02T00:00:00.000Z",
        updatedAt: "2026-09-02T00:00:00.000Z",
      },
      signals: [
        signalFixture({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11",
          title: "Sample",
          summary: "Sample summary.",
          signalType: "general_travel_news",
        }),
      ],
      sources: SOURCES,
    })!;

    const components = buildResearchScoreComponents(brief, []);

    const score = computeCompositeResearchScore(components);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 2);
  });
});
