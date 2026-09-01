import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createDeterministicEmbeddingProvider,
  evaluateSemanticCalibration,
  SEMANTIC_CALIBRATION_PAIRS,
  semanticTextFor,
  signalFixture,
} from "@/lib/marketing/research/__tests__/semanticCalibrationFixtures";
import { MVP_RESEARCH_SOURCES } from "@/lib/marketing/research/collectors/config";
import {
  buildAgendaCandidateFromBrief,
  rankAgendaCandidates,
} from "@/lib/marketing/research/services/agendaCandidateBuilder";
import { buildResearchBriefFromCluster } from "@/lib/marketing/research/services/briefBuilder";
import { scoreCorroboration } from "@/lib/marketing/research/services/corroborationScorer";
import { buildScoreReasons } from "@/lib/marketing/research/services/scoringPolicy";
import {
  buildResearchScoreComponents,
} from "@/lib/marketing/research/services/agendaCandidateBuilder";
import { passesSemanticMergeGuards } from "@/lib/marketing/research/services/semanticPrefilter";
import { runSemanticDedup } from "@/lib/marketing/research/services/semanticDeduplicator";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

const SOURCES = new Map<string, ResearchSource>(
  MVP_RESEARCH_SOURCES.map((s) => [
    s.id,
    { ...s, createdAt: "2026-09-02T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z" },
  ]),
);

describe("semantic calibration hard cases", () => {
  it("does not merge same airline different routes", async () => {
    const tokyo = signalFixture({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa20",
      title: "ANA expands Tokyo Haneda service",
      summary: "ANA expands Tokyo Haneda service with new frequencies.",
      signalType: "flight_route",
      destinations: ["tokyo"],
      topics: ["ana", "haneda"],
    });
    const osaka = signalFixture({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc0",
      title: "ANA adds Osaka Kansai flights",
      summary: "ANA adds Osaka Kansai flights on new schedule.",
      signalType: "flight_route",
      destinations: ["osaka"],
      topics: ["ana", "kansai"],
      rawFingerprint: "osaka-route",
      normalizedFingerprint: "osaka-route-n",
    });

    const result = await runSemanticDedup({
      signals: [tokyo, osaka],
      sources: SOURCES,
      provider: createDeterministicEmbeddingProvider(),
    });
    expect(result.duplicates).toHaveLength(0);
  });

  it("blocks weather signals with different forecast dates", () => {
    const day1 = signalFixture({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa21",
      title: "Okinawa typhoon warning Aug 1",
      summary: "Storm approaching Okinawa on August 1.",
      signalType: "weather",
      destinations: ["okinawa"],
      topics: ["weather"],
      publishedAt: "2026-08-01T00:00:00.000Z",
    });
    const day5 = signalFixture({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbd1",
      title: "Okinawa typhoon warning Aug 5",
      summary: "Storm approaching Okinawa on August 5.",
      signalType: "weather",
      destinations: ["okinawa"],
      topics: ["weather"],
      publishedAt: "2026-08-05T12:00:00.000Z",
      rawFingerprint: "okinawa-d5",
      normalizedFingerprint: "okinawa-d5-n",
    });

    const guard = passesSemanticMergeGuards(day1, day5, 72);
    expect(guard.ok).toBe(false);
    expect(guard.reasons.some((r) => r.startsWith("temporal_gap"))).toBe(true);
  });

  it("blocks visa vs destination promotion boundary", () => {
    const visa = signalFixture({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa22",
      title: "Japan visa waiver extension",
      summary: "Japan visa waiver extension for select countries.",
      signalType: "visa",
      destinations: ["japan"],
      topics: ["visa"],
    });
    const promo = signalFixture({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbe2",
      title: "Visit Japan tourism campaign",
      summary: "Visit Japan tourism campaign promotes autumn travel.",
      signalType: "destination_trend",
      destinations: ["japan"],
      topics: ["tourism"],
      rawFingerprint: "jp-promo",
      normalizedFingerprint: "jp-promo-n",
    });

    const guard = passesSemanticMergeGuards(visa, promo, 72);
    expect(guard.ok).toBe(false);
  });

  it("preserves brief evidence union in cluster brief", () => {
    const primary = signalFixture({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa23",
      title: "Portugal entry update",
      summary: "Portugal entry update.",
      signalType: "entry_requirement",
      evidence: [
        {
          id: "ev-23a",
          sourceId: MVP_RESEARCH_SOURCES[0]!.id,
          url: "https://example.com/official",
          excerpt: "Official excerpt.",
          observedAt: "2026-09-02T00:00:00.000Z",
          evidenceType: "official_statement",
        },
      ],
    });
    const secondary = signalFixture({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbf3",
      title: "Portugal entry update news",
      summary: "News coverage.",
      signalType: "entry_requirement",
      duplicateOfSignalId: primary.id,
      status: "duplicate",
      evidence: [
        {
          id: "ev-23b",
          sourceId: MVP_RESEARCH_SOURCES[1]!.id,
          url: "https://example.com/news",
          excerpt: "News excerpt.",
          observedAt: "2026-09-02T00:00:00.000Z",
          evidenceType: "direct_source",
        },
      ],
      rawFingerprint: "pt-news",
      normalizedFingerprint: "pt-news-n",
    });

    const brief = buildResearchBriefFromCluster({
      cluster: {
        id: "33333333-3333-4333-8333-333333333333",
        primarySignalId: primary.id,
        signalIds: [primary.id, secondary.id],
        clusterType: "event",
        createdAt: "2026-09-02T00:00:00.000Z",
        updatedAt: "2026-09-02T00:00:00.000Z",
      },
      signals: [primary, secondary],
      sources: SOURCES,
    })!;

    expect(brief.evidence).toHaveLength(2);
    expect(brief.evidence.map((e) => e.id).sort()).toEqual(["ev-23a", "ev-23b"]);
  });

  it("penalizes syndicated source families in corroboration", () => {
    const syndicatedSources = new Map(SOURCES);
    const syndicatedSourceIds = [
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa31",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa32",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa33",
    ];
    for (const id of syndicatedSourceIds) {
      syndicatedSources.set(id, {
        ...MVP_RESEARCH_SOURCES[1]!,
        id,
        name: "Syndicated Wire Mirror",
        provider: "wire-syndicate",
        createdAt: "2026-09-02T00:00:00.000Z",
        updatedAt: "2026-09-02T00:00:00.000Z",
      });
    }

    const syndicated = syndicatedSourceIds.map((sourceId, i) =>
      signalFixture({
        id: `synd-${i}`,
        title: `Syndicated story ${i}`,
        summary: `Syndicated story ${i}.`,
        signalType: "general_travel_news",
        sourceId,
        sourceType: "news",
        rawFingerprint: `synd-${i}-raw`,
        normalizedFingerprint: `synd-${i}-n`,
      }),
    );

    const result = scoreCorroboration({ clusterSignals: syndicated, sources: syndicatedSources });
    expect(result.sourceDiversityCount).toBe(3);
    expect(result.independentSourceCount).toBe(1);
    expect(result.reasons).toContain("syndicated_source_family_penalty");
  });

  it("batches embedding calls via embedMany", async () => {
    let embedManyCalls = 0;
    const provider = createDeterministicEmbeddingProvider();
    const original = provider.embedMany.bind(provider);
    provider.embedMany = async (texts: string[]) => {
      embedManyCalls += 1;
      return original(texts);
    };

    const signals = Array.from({ length: 5 }, (_, i) =>
      signalFixture({
        id: `batch-${i}`,
        title: `Japan visa update ${i}`,
        summary: `Japan visa update variant ${i}.`,
        signalType: "visa",
        destinations: ["japan"],
        rawFingerprint: `batch-${i}-raw`,
        normalizedFingerprint: `batch-${i}-n`,
      }),
    );

    await runSemanticDedup({ signals, sources: SOURCES, provider });
    expect(embedManyCalls).toBeGreaterThanOrEqual(1);
    expect(embedManyCalls).toBeLessThan(signals.length);
  });

  it("degrades gracefully when embedding provider throws", async () => {
    const provider = createDeterministicEmbeddingProvider();
    provider.embedMany = async () => {
      throw new Error("bge_unavailable");
    };

    const a = signalFixture({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa24",
      title: "Fallback A",
      summary: "Fallback A.",
      signalType: "safety",
    });
    const b = signalFixture({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbg4",
      title: "Fallback B",
      summary: "Fallback B.",
      signalType: "safety",
      rawFingerprint: "fb-b",
      normalizedFingerprint: "fb-b-n",
    });

    const result = await runSemanticDedup({ signals: [a, b], sources: SOURCES, provider });
    expect(result.metrics.status).toBe("degraded");
    expect(result.metrics.statusReason).toBe("bge_unavailable");
    expect(result.unique).toHaveLength(2);
  });

  it("penalizes stale signals in ranking", () => {
    const fresh = buildResearchBriefFromCluster({
      cluster: {
        id: "44444444-4444-4444-8444-444444444444",
        primarySignalId: "fresh-id",
        signalIds: ["fresh-id"],
        clusterType: "destination_group",
        createdAt: "2026-09-02T00:00:00.000Z",
        updatedAt: "2026-09-02T00:00:00.000Z",
      },
      signals: [
        signalFixture({
          id: "fresh-id",
          title: "Recent safety update",
          summary: "Recent safety update.",
          signalType: "safety",
          freshness: { observedAt: "2026-09-02T00:00:00.000Z", freshnessScore: 0.95 },
        }),
      ],
      sources: SOURCES,
    })!;

    const stale = buildResearchBriefFromCluster({
      cluster: {
        id: "55555555-5555-4555-8555-555555555555",
        primarySignalId: "stale-id",
        signalIds: ["stale-id"],
        clusterType: "destination_group",
        createdAt: "2026-09-02T00:00:00.000Z",
        updatedAt: "2026-09-02T00:00:00.000Z",
      },
      signals: [
        signalFixture({
          id: "stale-id",
          title: "Old commercial promo",
          summary: "Old commercial promo.",
          signalType: "internal_product",
          freshness: { observedAt: "2026-09-02T00:00:00.000Z", freshnessScore: 0.15 },
          commercialRelevance: { level: "high", matchedProductIds: ["p1"], confidence: 0.9 },
        }),
      ],
      sources: SOURCES,
    })!;

    const ranked = rankAgendaCandidates([
      buildAgendaCandidateFromBrief(stale),
      buildAgendaCandidateFromBrief(fresh),
    ]);
    expect(ranked[0]!.title).toContain("Recent");
  });

  it("penalizes low credibility community rumor", () => {
    const rumor = buildResearchBriefFromCluster({
      cluster: {
        id: "66666666-6666-4666-8666-666666666666",
        primarySignalId: "rumor-id",
        signalIds: ["rumor-id"],
        clusterType: "destination_group",
        createdAt: "2026-09-02T00:00:00.000Z",
        updatedAt: "2026-09-02T00:00:00.000Z",
      },
      signals: [
        signalFixture({
          id: "rumor-id",
          title: "Unverified border rumor",
          summary: "Unverified border rumor.",
          signalType: "general_travel_news",
          sourceType: "community",
          credibility: { score: 0.25, level: "low", reasons: ["community"] },
        }),
      ],
      sources: SOURCES,
    })!;

    const candidate = buildAgendaCandidateFromBrief(rumor);
    expect(candidate.riskFlags).toContain("low_credibility");
    expect(candidate.credibilityScore).toBeLessThan(0.4);
    expect(candidate.compositeResearchScore).toBeLessThan(0.7);
  });

  it("keeps ranking reasons deterministic", () => {
    const brief = buildResearchBriefFromCluster({
      cluster: {
        id: "77777777-7777-4777-8777-777777777777",
        primarySignalId: "reason-id",
        signalIds: ["reason-id"],
        clusterType: "destination_group",
        createdAt: "2026-09-02T00:00:00.000Z",
        updatedAt: "2026-09-02T00:00:00.000Z",
      },
      signals: [
        signalFixture({
          id: "reason-id",
          title: "Deterministic reasons",
          summary: "Deterministic reasons.",
          signalType: "visa",
        }),
      ],
      sources: SOURCES,
    })!;

    const components = buildResearchScoreComponents(brief, []);
    const reasonsA = buildScoreReasons(components);
    const reasonsB = buildScoreReasons(components);
    expect(reasonsA).toEqual(reasonsB);
  });

  it("does not merge different country official advisories with shared topics only", async () => {
    const bolivia = signalFixture({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa40",
      title: "bolivia",
      summary: "Bolivia travel advice.",
      signalType: "safety",
      destinations: ["bolivia"],
      topics: ["safety", "travel"],
      sourceType: "official_government",
    });
    const taiwan = signalFixture({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbd0",
      title: "taiwan",
      summary: "Taiwan travel advice.",
      signalType: "entry_requirement",
      destinations: ["taiwan"],
      topics: ["travel", "visa"],
      sourceType: "official_government",
      rawFingerprint: "tw-raw",
      normalizedFingerprint: "tw-n",
    });

    const provider = createDeterministicEmbeddingProvider();
    provider.pinSimilar(semanticTextFor(bolivia), semanticTextFor(taiwan));

    const result = await runSemanticDedup({
      signals: [bolivia, taiwan],
      sources: SOURCES,
      provider,
    });
    expect(result.duplicates).toHaveLength(0);
  });

  it("evaluates calibration fixture with conservative precision", async () => {
    const provider = createDeterministicEmbeddingProvider();
    const mergeDecisions = new Map<string, boolean>();

    for (const pair of SEMANTIC_CALIBRATION_PAIRS) {
      const a = signalFixture(pair.a);
      const b = signalFixture(pair.b);
      if (pair.pinSimilar) {
        provider.pinSimilar(semanticTextFor(a), semanticTextFor(b));
      }
      const result = await runSemanticDedup({
        signals: [a, b],
        sources: SOURCES,
        provider,
      });
      mergeDecisions.set(`${pair.a.id}:${pair.b.id}`, result.duplicates.length > 0);
    }

    const metrics = evaluateSemanticCalibration({ pairs: SEMANTIC_CALIBRATION_PAIRS, mergeDecisions });
    expect(metrics.falseMerge).toBe(0);
    expect(metrics.precision).toBeGreaterThanOrEqual(0.99);
    expect(metrics.trueMerge).toBeGreaterThanOrEqual(1);
  });
});
