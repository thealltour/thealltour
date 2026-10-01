import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERFORMANCE_MEMORY_SOURCE, PERFORMANCE_MEMORY_SOURCE_ID } from "@/lib/marketing/performance/constants";
import type { ContentPerformanceRepository } from "@/lib/marketing/performance/repository/contracts";
import { createInMemoryContentPerformanceRepository } from "@/lib/marketing/performance/repository/inMemoryContentPerformanceRepository";
import { bootstrapResearchSources } from "@/lib/marketing/research/collection/bootstrapSources";
import { loadPerformanceFeedbackSignals } from "@/lib/marketing/research/collection/loadPerformanceFeedbackSignals";
import {
  COLLECTOR_IDENTITY_MISSING,
  COLLECTOR_SOURCE_UNREGISTERED,
  runResearchCollectionCycle,
} from "@/lib/marketing/research/collection/runResearchCollectionCycle";
import {
  BOOTSTRAP_RESEARCH_SOURCES,
  EXTERNAL_RESEARCH_SOURCE_REGISTRY,
  META_AI_TREND_SOURCE_DEFINITION,
  MVP_RESEARCH_SOURCES,
  PERFORMANCE_MEMORY_SOURCE_DEFINITION,
  RESEARCH_SOURCE_REGISTRY,
  TRAVELTIMES_SOURCE,
  TRAVIE_SOURCE,
  createDefaultResearchCollectors,
  findResearchSourceDefinition,
  mapRawResearchItemToSignalInput,
  projectResearchSource,
  type ResearchCollector,
} from "@/lib/marketing/research/collectors";
import { resolveSourceRoleWeights } from "@/lib/marketing/research/portfolio/sourcePortfolioRoles";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import { normalizeResearchSignal } from "@/lib/marketing/research/services/normalizer";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import {
  META_AI_TREND_SOURCE_ID,
  adaptTrendSignalToResearch,
  buildMetaAiTrendSource,
  persistAdaptedTrend,
} from "@/lib/marketing/trends/adapter/trendSourceAdapter";
import {
  FIXTURE_BUSAN_FAMILY_CRUISE,
  POSITIVE_TREND_FIXTURES,
} from "@/lib/marketing/trends/fixtures/positiveFixtures";
import {
  PARITY_FIXTURE_BY_FEED,
  mockFeedFetch,
  withoutRemovedDeadMetadata,
  withoutSemantics,
} from "@/lib/marketing/research/__tests__/sourceRegistryParityFixtures";

const NOW = new Date("2026-10-01T09:00:00.000Z");
const ENABLED_ENV = { RESEARCH_COLLECTION_ENABLED: "true" };

/** Pre-registry Performance Memory row (`performance/constants.ts` literal). */
const LEGACY_PERFORMANCE_MEMORY_ROW = {
  id: "44444444-4444-4444-8444-444444444444",
  sourceType: "performance_memory",
  name: "Performance Analyst Memory",
  authorityLevel: "primary",
  defaultCredibility: 0.75,
  language: "ko",
  isOfficial: false,
  isEnabled: true,
  metadata: {
    adapter: "performance_signal",
    advisoryOnly: true,
    portfolio: {
      role: "performance_memory",
      agendaSeedWeight: 0.35,
      evidenceAuthorityWeight: 0.4,
      koreanMarketWeight: 0.7,
    },
  },
};

/** Current Performance Memory row: the legacy row without the dead `portfolio.evidenceAuthorityWeight`. */
const PERFORMANCE_MEMORY_ROW = withoutRemovedDeadMetadata(LEGACY_PERFORMANCE_MEMORY_ROW);

/** Pre-registry Meta Trend row (`buildMetaAiTrendSource` literal, without timestamps). */
const LEGACY_META_TREND_ROW = {
  id: "a1000000-0000-4000-8000-000000000001",
  sourceType: "social",
  name: "Meta AI Trend Discovery",
  canonicalUrl: null,
  provider: "meta_ai",
  authorityLevel: "community",
  defaultCredibility: 0.35,
  locale: "ko-KR",
  country: "KR",
  language: "ko",
  isOfficial: false,
  isEnabled: true,
  metadata: {
    role: "trend_discovery_editorial_intelligence_provider",
    neverAccesses: ["agenda_finalize", "cmc", "hmr", "publication", "sns"],
  },
};

const LEGACY_COLLECTORS = [
  ["uk-gov-travel-advice", "a3011111-1111-4111-8111-111111111101", "official_government"],
  ["nyt-travel-rss", "a3022222-2222-4222-8222-222222222222", "news"],
  ["traveltimes-rss", "a3033333-3333-4333-8333-333333333333", "travel_industry"],
  ["travie-rss", "a3044444-4444-4444-8444-444444444444", "travel_industry"],
  ["traveldaily-rss", "a3055555-5555-4555-8555-555555555555", "travel_industry"],
  ["vietnam-travel-rss", "a3066666-6666-4666-8666-666666666666", "tourism_board"],
] as const;

/** Normalized fingerprints produced by the pre-Phase-2 collectors for the parity fixtures. */
const LEGACY_FIXTURE_NORMALIZED_FINGERPRINTS: Record<string, string[]> = {
  "uk-gov-travel-advice": [
    "3d408872448da4ef69bc66e3b16b0b9e603e0fa1ba6ec86264101b06caf7a3ff",
    "1fb0a5e24bb55457ff3a6d198888d7991c2be51e2e06b9f127adbc3a4b237378",
    "2986b8f7b3864c61497d8c29a1152622e206d1176b058a882b53e59b61866e0d",
  ],
  "nyt-travel-rss": [
    "8787bec355695b5078499df5ef6c5c954468844f1de4c89b499ce15abfe5ba9d",
    "4e41109123cdf5a1e25d16dff7cce113bd4326c31dd749c302858f3f2a5908e1",
  ],
  "traveltimes-rss": [
    "9a4f99995d0cc480669f6ea194d975b2b56fdf4512ed10128b3b68abaa8bca92",
    "04a0f9b79178214a4b87882140c51ce8f3804ae8c44f6fb1658c321183f16866",
  ],
  "travie-rss": [
    "9a4f99995d0cc480669f6ea194d975b2b56fdf4512ed10128b3b68abaa8bca92",
    "04a0f9b79178214a4b87882140c51ce8f3804ae8c44f6fb1658c321183f16866",
  ],
  "traveldaily-rss": [
    "9a4f99995d0cc480669f6ea194d975b2b56fdf4512ed10128b3b68abaa8bca92",
    "04a0f9b79178214a4b87882140c51ce8f3804ae8c44f6fb1658c321183f16866",
  ],
  "vietnam-travel-rss": [
    "8b2f0627b38ccac4f3f25c45916d874c27030734067541b33ab7d7ec29409553",
    "8605d1b7bc42874158bd915b582587a67de720cfd86243d52cb33c4753cc8b91",
    "eab42a65f3b15e62a6fad569fab7994a297bde2891e306552d80c7919400ffd0",
  ],
};

function withTimestamps<T extends object>(row: T, iso: string) {
  return { ...row, createdAt: iso, updatedAt: iso };
}

function defaultCollectors() {
  return createDefaultResearchCollectors({ fetchImpl: mockFeedFetch(PARITY_FIXTURE_BY_FEED) });
}

async function seedPerformanceSnapshots(repo: ReturnType<typeof createInMemoryContentPerformanceRepository>) {
  for (const [i, origin] of (["human_edited", "ai_unchanged"] as const).entries()) {
    await repo.save({
      snapshot: {
        collectionId: `pcol_wiring_${i}`,
        logicalObservationKey: `wiring-obs-${i}`,
        candidateId: `cmc_wiring_${i}`,
        humanReviewId: `hmr_wiring_${i}`,
        platform: "threads",
        channel: "threads",
        externalPostId: `wiring_post_${i}`,
        publishedAt: "2026-09-30T10:00:00.000Z",
        publicationSource: "manual",
        contentOrigin: origin,
        collectionStatus: "success",
        observedAt: `2026-10-01T0${i + 1}:00:00.000Z`,
        dataAvailability: "available",
        topic: `오사카 가을 여행 성과 ${i}`,
        destinations: ["japan"],
        format: "thread",
        commercialIntent: "awareness",
        productLinked: false,
        sampleQuality: "single_post_sample",
      },
      metrics: [
        { metricType: "impressions", metricValue: 800 + i * 100 },
        { metricType: "likes", metricValue: 40 + i },
      ],
    });
  }
}

describe("source registry runtime wiring — collector identity", () => {
  it("default collectors carry registry sourceId/sourceType in legacy order", () => {
    expect(createDefaultResearchCollectors().map((c) => [c.collectorId, c.sourceId, c.sourceType])).toEqual(LEGACY_COLLECTORS);
    for (const collector of createDefaultResearchCollectors()) {
      const definition = findResearchSourceDefinition(collector.sourceId);
      expect(definition?.kind).toBe("feed");
      expect(definition?.sourceType).toBe(collector.sourceType);
    }
  });

  it("the cycle takes sourceId from the collector, not from a collectorId lookup", async () => {
    const travieCollector = defaultCollectors().find((c) => c.collectorId === "travie-rss")!;
    const relabeled: ResearchCollector = { ...travieCollector, collectorId: "custom-travie-mirror" };
    const crossWired: ResearchCollector = { ...travieCollector, sourceId: TRAVELTIMES_SOURCE.id };

    const result = await runResearchCollectionCycle({
      repo: createInMemoryResearchRepository(),
      now: NOW,
      env: ENABLED_ENV,
      collectors: [relabeled, crossWired],
    });

    expect(result.collectorResults.map((r) => [r.collectorId, r.sourceId, r.status])).toEqual([
      ["custom-travie-mirror", TRAVIE_SOURCE.id, "success"],
      ["travie-rss", TRAVELTIMES_SOURCE.id, "success"],
    ]);
  });

  it("requires sourceId on injected collectors at compile time", () => {
    // @ts-expect-error sourceId is part of collector identity
    const missing: ResearchCollector = { collectorId: "no-identity", sourceType: "news", collect: async () => [] };
    expect(missing.collectorId).toBe("no-identity");
  });
});

describe("source registry runtime wiring — no silent skip", () => {
  it("reports an identity-less collector as failed and keeps running the others", async () => {
    const collect = vi.fn(async () => []);
    const noIdentity = { collectorId: "no-identity-rss", sourceType: "news", collect } as unknown as ResearchCollector;
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await runResearchCollectionCycle({
      repo: createInMemoryResearchRepository(),
      now: NOW,
      env: ENABLED_ENV,
      collectors: [noIdentity, ...defaultCollectors()],
    });
    const logged = info.mock.calls.map((call) => call.join(" "));
    info.mockRestore();

    expect(result.collectorResults[0]).toMatchObject({
      collectorId: "no-identity-rss",
      sourceId: null,
      status: "failed",
      itemsObserved: 0,
      errors: [{ code: COLLECTOR_IDENTITY_MISSING, message: "collector no-identity-rss has no sourceId" }],
    });
    expect(collect).not.toHaveBeenCalled();
    expect(result.collectorResults.slice(1).map((r) => [r.collectorId, r.status])).toEqual(
      LEGACY_COLLECTORS.map(([collectorId]) => [collectorId, "success"]),
    );
    expect(result.status).toBe("partial_success");
    expect(logged.some((line) => line.includes(COLLECTOR_IDENTITY_MISSING))).toBe(true);
  });

  it("reports a collector whose sourceId is not registered as failed", async () => {
    const collect = vi.fn(async () => []);
    const unregistered: ResearchCollector = {
      collectorId: "unregistered-rss",
      sourceId: "b0000000-0000-4000-8000-00000000dead",
      sourceType: "news",
      collect,
    };

    const result = await runResearchCollectionCycle({
      repo: createInMemoryResearchRepository(),
      now: NOW,
      env: ENABLED_ENV,
      collectors: [...defaultCollectors(), unregistered],
    });

    expect(result.collectorResults.at(-1)).toMatchObject({
      collectorId: "unregistered-rss",
      sourceId: "b0000000-0000-4000-8000-00000000dead",
      status: "failed",
      errors: [{ code: COLLECTOR_SOURCE_UNREGISTERED }],
    });
    expect(collect).not.toHaveBeenCalled();
    expect(result.collectorResults.filter((r) => r.status === "success")).toHaveLength(6);
  });

  it("checks identity before the env toggle, so a disabled misconfigured collector is still visible", async () => {
    const noIdentity = { collectorId: "travie-rss", sourceType: "travel_industry", collect: async () => [] } as unknown as ResearchCollector;
    const result = await runResearchCollectionCycle({
      repo: createInMemoryResearchRepository(),
      now: NOW,
      env: { ...ENABLED_ENV, RESEARCH_TRAVIE_RSS_ENABLED: "false" },
      collectors: [noIdentity],
    });
    expect(result.collectorResults).toEqual([
      expect.objectContaining({ status: "failed", sourceId: null, errors: [expect.objectContaining({ code: COLLECTOR_IDENTITY_MISSING })] }),
    ]);
  });
});

describe("source registry runtime wiring — no unknown sourceId", () => {
  it("never emits an unknown sourceId for production collectors, including disabled ones", async () => {
    const result = await runResearchCollectionCycle({
      repo: createInMemoryResearchRepository(),
      now: NOW,
      env: { ...ENABLED_ENV, RESEARCH_TRAVIE_RSS_ENABLED: "false", RESEARCH_UK_GOV_TRAVEL_ADVICE_ENABLED: "false" },
      collectors: defaultCollectors(),
    });
    expect(result.collectorResults.map((r) => [r.collectorId, r.sourceId, r.status])).toEqual(
      LEGACY_COLLECTORS.map(([collectorId, sourceId]) => [
        collectorId,
        sourceId,
        collectorId === "travie-rss" || collectorId === "uk-gov-travel-advice" ? "skipped" : "success",
      ]),
    );
    for (const r of result.collectorResults) {
      expect(findResearchSourceDefinition(r.sourceId ?? "")).toBeTruthy();
    }
  });
});

describe("source registry runtime wiring — external parity", () => {
  it.each(Object.keys(LEGACY_FIXTURE_NORMALIZED_FINGERPRINTS))("%s keeps legacy normalized fingerprints", async (collectorId) => {
    const collector = defaultCollectors().find((c) => c.collectorId === collectorId)!;
    const source = MVP_RESEARCH_SOURCES.find((s) => s.id === collector.sourceId)!;
    const record: ResearchSource = withTimestamps(source, NOW.toISOString());
    const items = await collector.collect({ sourceId: collector.sourceId, sourceType: collector.sourceType, now: NOW, maxItems: 25 });
    const fingerprints = items.map((item) => {
      const mapped = mapRawResearchItemToSignalInput(item, { sourceId: collector.sourceId, sourceType: collector.sourceType });
      const normalized = mapped ? normalizeResearchSignal(mapped, record, NOW) : null;
      return normalized?.ok ? normalized.signal.normalizedFingerprint : null;
    });
    expect(fingerprints).toEqual(LEGACY_FIXTURE_NORMALIZED_FINGERPRINTS[collectorId]);
  });
});

describe("source registry runtime wiring — Performance Memory identity", () => {
  it("derives the Performance Memory row from the registry with legacy values", () => {
    expect(PERFORMANCE_MEMORY_SOURCE_DEFINITION.kind).toBe("internal");
    expect(PERFORMANCE_MEMORY_SOURCE_ID).toBe(PERFORMANCE_MEMORY_SOURCE_DEFINITION.id);
    expect(withoutSemantics(PERFORMANCE_MEMORY_SOURCE)).toStrictEqual(PERFORMANCE_MEMORY_ROW);
    expect(withoutSemantics(projectResearchSource(PERFORMANCE_MEMORY_SOURCE_DEFINITION))).toStrictEqual(
      PERFORMANCE_MEMORY_ROW,
    );
    expect(resolveSourceRoleWeights(PERFORMANCE_MEMORY_SOURCE)).toEqual({
      portfolioRole: "performance_memory",
      agendaSeedWeight: 0.35,
      koreanMarketWeight: 0.7,
    });
  });

  it("keeps the performance feedback loader and cycle result contract", async () => {
    const perfRepo = createInMemoryContentPerformanceRepository();
    await seedPerformanceSnapshots(perfRepo);
    const repo = createInMemoryResearchRepository();

    const load = await loadPerformanceFeedbackSignals({ repo, performanceRepo: perfRepo, since: "2026-09-01T00:00:00.000Z", now: NOW });
    expect(load.status).toBe("ok");
    expect(load.signals.map((s) => [s.sourceId, s.sourceType, s.signalType, s.evidence[0]?.sourceId])).toEqual([
      [LEGACY_PERFORMANCE_MEMORY_ROW.id, "performance_memory", "content_performance", LEGACY_PERFORMANCE_MEMORY_ROW.id],
      [LEGACY_PERFORMANCE_MEMORY_ROW.id, "performance_memory", "content_performance", LEGACY_PERFORMANCE_MEMORY_ROW.id],
    ]);
    expect(withoutSemantics(await repo.getSourceById(LEGACY_PERFORMANCE_MEMORY_ROW.id))).toEqual(
      withTimestamps(PERFORMANCE_MEMORY_ROW, NOW.toISOString()),
    );

    const cycle = await runResearchCollectionCycle({
      repo: createInMemoryResearchRepository(),
      performanceRepo: perfRepo,
      collectors: [],
      now: NOW,
      env: ENABLED_ENV,
    });
    expect(cycle.collectorResults).toEqual([
      expect.objectContaining({
        collectorId: "performance-feedback",
        sourceId: LEGACY_PERFORMANCE_MEMORY_ROW.id,
        status: "success",
        itemsObserved: 2,
        itemsAccepted: 2,
        errors: [],
      }),
    ]);
    expect(cycle.totals.performanceFeedbackStatus).toBe("ok");
  });

  it("keeps the degraded performance feedback result identity", async () => {
    const failingRepo = {
      listRecent: async () => {
        throw new Error("perf store offline");
      },
    } as unknown as ContentPerformanceRepository;
    const cycle = await runResearchCollectionCycle({
      repo: createInMemoryResearchRepository(),
      performanceRepo: failingRepo,
      collectors: [],
      now: NOW,
      env: ENABLED_ENV,
    });
    expect(cycle.collectorResults).toEqual([
      expect.objectContaining({
        collectorId: "performance-feedback",
        sourceId: LEGACY_PERFORMANCE_MEMORY_ROW.id,
        status: "partial",
        errors: [{ code: "performance_feedback_degraded", message: "perf store offline" }],
      }),
    ]);
  });
});

describe("source registry runtime wiring — Meta Trend identity", () => {
  it("registers Meta Trend as a push source with the legacy row", () => {
    expect(META_AI_TREND_SOURCE_DEFINITION.kind).toBe("push");
    expect(META_AI_TREND_SOURCE_ID).toBe(LEGACY_META_TREND_ROW.id);
    expect(findResearchSourceDefinition(LEGACY_META_TREND_ROW.id)).toBe(META_AI_TREND_SOURCE_DEFINITION);
    expect(withoutSemantics(buildMetaAiTrendSource(NOW))).toStrictEqual(
      withTimestamps(LEGACY_META_TREND_ROW, NOW.toISOString()),
    );
  });

  it("keeps the accidental `other` portfolio fallback (no metadata.portfolio)", () => {
    const source = buildMetaAiTrendSource(NOW);
    expect(source.metadata).not.toHaveProperty("portfolio");
    expect(resolveSourceRoleWeights(source)).toEqual({
      portfolioRole: "other",
      agendaSeedWeight: 0.4,
      koreanMarketWeight: 0.4,
    });
  });

  it("does not share metadata objects between built Meta sources", () => {
    const first = buildMetaAiTrendSource(NOW);
    (first.metadata!.neverAccesses as string[]).push("mutated");
    expect(withoutSemantics(buildMetaAiTrendSource(NOW)).metadata).toEqual(LEGACY_META_TREND_ROW.metadata);
  });

  it("keeps push persistence: stored row, 0.35 credibility, fingerprints and candidate scores", async () => {
    const repo = createInMemoryResearchRepository();
    const persisted = await persistAdaptedTrend(adaptTrendSignalToResearch(FIXTURE_BUSAN_FAMILY_CRUISE, NOW), repo);

    expect(withoutSemantics(await repo.getSourceById(LEGACY_META_TREND_ROW.id))).toEqual(
      withTimestamps(LEGACY_META_TREND_ROW, NOW.toISOString()),
    );
    expect(persisted.signal).toMatchObject({
      sourceId: LEGACY_META_TREND_ROW.id,
      sourceType: "social",
      signalType: "destination_trend",
      rawFingerprint: "meta_trend:meta_ai:meta_obs_busan_cruise_001",
      normalizedFingerprint: "meta_trend:meta_obs_busan_cruise_001",
      credibility: { score: 0.35, level: "low", reasons: ["meta_trend_provider", "unverified_facts"] },
    });
    expect(persisted.agendaCandidate.credibilityScore).toBe(0.35);
    expect(persisted.agendaCandidate.compositeResearchScore).toBeCloseTo(0.5265, 6);
    expect(persisted.agendaCandidate.riskFlags).toEqual([
      "meta_factual_unverified",
      "trend_provider_not_authority",
      "low_credibility",
    ]);
  });

  it("is not part of the bootstrap set (still upserted on push)", () => {
    expect(BOOTSTRAP_RESEARCH_SOURCES.some((s) => s.id === LEGACY_META_TREND_ROW.id)).toBe(false);
    expect(POSITIVE_TREND_FIXTURES.length).toBeGreaterThan(0);
  });
});

describe("source registry runtime wiring — bootstrap", () => {
  it("bootstraps the legacy six external rows plus Performance Memory, deep equal", async () => {
    const repo = createInMemoryResearchRepository();
    const returned = await bootstrapResearchSources(repo, NOW);
    const iso = NOW.toISOString();

    expect(returned.map(withoutSemantics)).toStrictEqual(
      [...MVP_RESEARCH_SOURCES.map(withoutSemantics), PERFORMANCE_MEMORY_ROW].map((row) => withTimestamps(row, iso)),
    );
    for (const row of returned) {
      expect(await repo.getSourceById(row.id)).toEqual(row);
    }
  });

  it("has no duplicate or missing registry sources", () => {
    const ids = RESEARCH_SOURCE_REGISTRY.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(RESEARCH_SOURCE_REGISTRY.map((s) => [s.kind, s.id])).toEqual([
      ...EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((s) => ["feed", s.id]),
      ["internal", LEGACY_PERFORMANCE_MEMORY_ROW.id],
      ["push", LEGACY_META_TREND_ROW.id],
    ]);
    expect(BOOTSTRAP_RESEARCH_SOURCES.map((s) => s.id)).toEqual([
      ...LEGACY_COLLECTORS.map(([, sourceId]) => sourceId),
      LEGACY_PERFORMANCE_MEMORY_ROW.id,
    ]);
  });

  it("preserves createdAt of existing rows on re-bootstrap", async () => {
    const repo = createInMemoryResearchRepository();
    await bootstrapResearchSources(repo, NOW);
    const later = new Date("2026-10-02T09:00:00.000Z");
    const second = await bootstrapResearchSources(repo, later);
    for (const row of second) {
      expect(row.createdAt).toBe(NOW.toISOString());
      expect(row.updatedAt).toBe(later.toISOString());
    }
  });
});
