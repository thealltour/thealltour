import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PERFORMANCE_MEMORY_SOURCE } from "@/lib/marketing/performance/constants";
import { createInMemoryContentPerformanceRepository } from "@/lib/marketing/performance/repository/inMemoryContentPerformanceRepository";
import {
  RESEARCH_SIGNAL_TYPES,
  RESEARCH_SOURCE_COMMERCIAL_BIAS_LEVELS,
  RESEARCH_SOURCE_COVERAGE_SCOPES,
  RESEARCH_SOURCE_LIFECYCLE_STATUSES,
  researchSourceSemanticsSchema,
  type ResearchSourceSemantics,
} from "@/lib/marketing/research";
import { bootstrapResearchSources } from "@/lib/marketing/research/collection/bootstrapSources";
import { loadPerformanceFeedbackSignals } from "@/lib/marketing/research/collection/loadPerformanceFeedbackSignals";
import { runResearchCollectionCycle } from "@/lib/marketing/research/collection/runResearchCollectionCycle";
import {
  BOOTSTRAP_RESEARCH_SOURCES,
  EXTERNAL_RESEARCH_SOURCE_REGISTRY,
  META_AI_TREND_SOURCE_DEFINITION,
  MVP_RESEARCH_SOURCES,
  NYT_TRAVEL_SOURCE,
  PERFORMANCE_MEMORY_SOURCE_DEFINITION,
  RESEARCH_SOURCE_REGISTRY,
  TRAVELDAILY_SOURCE,
  TRAVELTIMES_SOURCE,
  TRAVIE_SOURCE,
  UK_GOV_TRAVEL_SOURCE,
  VIETNAM_TRAVEL_SOURCE,
  createResearchCollectorForSource,
  mapRawResearchItemToSignalInput,
  projectResearchSource,
  toConfiguredRssCollectorConfig,
  type ExternalResearchSourceDefinition,
  type ResearchSourceDefinition,
} from "@/lib/marketing/research/collectors";
import {
  inferNewsSignalType,
  inferOfficialSignalType,
} from "@/lib/marketing/research/collectors/mappers/helpers";
import { getMarketingManagerResearchContext } from "@/lib/marketing/research/manager/getMarketingManagerResearchContext";
import {
  buildSourcePortfolioMetadata,
  resolveSourceRoleWeights,
} from "@/lib/marketing/research/portfolio/sourcePortfolioRoles";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import { destinationTopicFamilyKey } from "@/lib/marketing/research/services/diversifyAgendaCandidatesForCuration";
import { normalizeResearchSignal } from "@/lib/marketing/research/services/normalizer";
import { runResearchPipeline } from "@/lib/marketing/research/services/pipeline";
import type { RawResearchSignalInput } from "@/lib/marketing/research/types/researchSignal";
import {
  adaptTrendSignalToResearch,
  buildMetaAiTrendSource,
  persistAdaptedTrend,
} from "@/lib/marketing/trends/adapter/trendSourceAdapter";
import { FIXTURE_BUSAN_FAMILY_CRUISE } from "@/lib/marketing/trends/fixtures/positiveFixtures";
import {
  PARITY_FIXTURE_BY_FEED,
  mockFeedFetch,
  withoutSemantics,
} from "@/lib/marketing/research/__tests__/sourceRegistryParityFixtures";

const NOW = new Date("2026-10-01T09:00:00.000Z");
const ISO = NOW.toISOString();
const ENABLED_ENV = { RESEARCH_COLLECTION_ENABLED: "true" };

/** Fixture items no keyword rule matches, so their signal type is the runtime fallback. */
const FALLBACK_ITEM_TITLE_BY_KEY: Record<string, string> = {
  "uk-gov-travel-advice": "Italy",
  "nyt-travel-rss": "A Long Weekend in Lisbon",
  "traveltimes-rss": "가을엔 3대가 함께 코타키나발루로",
  "travie-rss": "가을엔 3대가 함께 코타키나발루로",
  "traveldaily-rss": "가을엔 3대가 함께 코타키나발루로",
  "vietnam-travel-rss": "A celestial journey through Vietnam",
};

/** Read only by the final MM rank seed; collection, pipeline and cycle output must not change. */
const MM_RANK_ONLY_PATCH: Partial<ResearchSourceSemantics> = {
  commercialBias: "high",
};

/**
 * Parity fixture items whose own text the existing place inference resolves to nothing, so a
 * single-country coverage would fill their geography. "도쿄권" is a known miss of that inference.
 */
const COVERAGE_FALLBACK_TITLES = [
  "A Long Weekend in Lisbon",
  "가을엔 3대가 함께 코타키나발루로",
  "추석 앞두고 도쿄권 태풍 변수…275편 결항 뒤 상황은",
];

/** Deliberately different from every registry value, runtime-read fields included. */
const ALTERED_SEMANTICS: ResearchSourceSemantics = {
  commercialBias: "high",
  coverage: { scope: "city", countries: ["FR"], cities: ["Paris"] },
  languages: { primary: "vi" },
  classification: { defaultSignalType: "safety" },
  lifecycle: { status: "shadow", note: "altered fixture" },
};

const REGISTRY_IDS = new Set(RESEARCH_SOURCE_REGISTRY.map((s) => s.id));
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VOLATILE_KEYS = new Set(["id", "createdAt", "updatedAt", "startedAt", "completedAt", "cycleId", "durationMs"]);

/** Replaces random ids and wall-clock timestamps so two runs can be deep-compared. */
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, VOLATILE_KEYS.has(k) ? "<volatile>" : stable(v)]),
    );
  }
  if (typeof value === "string" && UUID_PATTERN.test(value) && !REGISTRY_IDS.has(value)) return "<uuid>";
  return value;
}

function canonicalSet(list: readonly unknown[]): string[] {
  return list.map((entry) => JSON.stringify(stable(entry))).sort();
}

function withSemantics<T extends ResearchSourceDefinition>(
  source: T,
  patch: Partial<ResearchSourceSemantics>,
): T {
  const clone = structuredClone(source);
  clone.semantics = { ...clone.semantics, ...structuredClone(patch) };
  return clone;
}

function externalDefinitions(patch?: Partial<ResearchSourceSemantics>): ExternalResearchSourceDefinition[] {
  return EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((source) => (patch ? withSemantics(source, patch) : source));
}

async function collectAll(definitions: readonly ExternalResearchSourceDefinition[]) {
  const rows = [];
  for (const source of definitions) {
    const collector = createResearchCollectorForSource(source, { fetchImpl: mockFeedFetch(PARITY_FIXTURE_BY_FEED) });
    const items = await collector.collect({ sourceId: source.id, sourceType: source.sourceType, now: NOW, maxItems: 25 });
    for (const item of items) {
      const mapped = mapRawResearchItemToSignalInput(item, { sourceId: source.id, sourceType: source.sourceType });
      const normalized = mapped
        ? normalizeResearchSignal(mapped, { ...projectResearchSource(source), createdAt: ISO, updatedAt: ISO }, NOW)
        : null;
      rows.push({
        key: source.key,
        item,
        mapped,
        signalType: mapped?.signalType ?? null,
        rawFingerprint: normalized?.ok ? normalized.signal.rawFingerprint : null,
        normalizedFingerprint: normalized?.ok ? normalized.signal.normalizedFingerprint : null,
        signal: normalized?.ok ? normalized.signal : null,
      });
    }
  }
  return rows;
}

/** Collect → pipeline → MM context with source rows projected from the given definitions. */
async function runScenario(definitions: readonly ExternalResearchSourceDefinition[]) {
  const repo = createInMemoryResearchRepository();
  for (const source of definitions) {
    await repo.upsertSource({ ...projectResearchSource(source), createdAt: ISO, updatedAt: ISO });
  }
  const collected = await collectAll(definitions);
  const rawSignals: RawResearchSignalInput[] = collected.flatMap((row) => (row.mapped ? [row.mapped] : []));
  const pipeline = await runResearchPipeline({ repo, rawSignals, now: NOW });
  const mm = await getMarketingManagerResearchContext(
    { lookbackHours: 168, limit: 30 },
    { repo, now: NOW, checkSemanticInfrastructure: async () => false },
  );
  const sources = await repo.listEnabledSources();
  return { collected, pipeline, mm, sources };
}

async function runCycle(definitions: readonly ExternalResearchSourceDefinition[]) {
  const cycle = await runResearchCollectionCycle({
    repo: createInMemoryResearchRepository(),
    now: NOW,
    env: ENABLED_ENV,
    collectors: definitions.map((source) =>
      createResearchCollectorForSource(source, { fetchImpl: mockFeedFetch(PARITY_FIXTURE_BY_FEED) }),
    ),
  });
  return {
    status: cycle.status,
    collectorResults: stable(cycle.collectorResults),
    candidates: canonicalSet(cycle.pipeline?.agendaCandidates ?? []),
  };
}

function candidateScores(result: Awaited<ReturnType<typeof runScenario>>) {
  return canonicalSet(
    result.pipeline.agendaCandidates.map((c) => ({
      title: c.title,
      compositeResearchScore: c.compositeResearchScore,
      credibilityScore: c.credibilityScore,
      koreanOutboundRelevanceScore: c.koreanOutboundRelevanceScore,
      researchScoreComponents: c.researchScoreComponents,
      scoreReasons: c.scoreReasons,
      riskFlags: c.riskFlags,
    })),
  );
}

async function seedPerformanceSnapshots(repo: ReturnType<typeof createInMemoryContentPerformanceRepository>) {
  for (const [i, origin] of (["human_edited", "ai_unchanged"] as const).entries()) {
    await repo.save({
      snapshot: {
        collectionId: `pcol_semantics_${i}`,
        logicalObservationKey: `semantics-obs-${i}`,
        candidateId: `cmc_semantics_${i}`,
        humanReviewId: `hmr_semantics_${i}`,
        platform: "threads",
        channel: "threads",
        externalPostId: `semantics_post_${i}`,
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

describe("source semantics — schema", () => {
  it("1. every registry source declares a semantics block that also lands in its projection", () => {
    expect(RESEARCH_SOURCE_REGISTRY).toHaveLength(8);
    for (const source of RESEARCH_SOURCE_REGISTRY) {
      expect(source.semantics).toBeDefined();
      expect(projectResearchSource(source).metadata?.semantics).toEqual(source.semantics);
    }
  });

  it("2-6. every semantics block passes the strict schema with enum-valid values", () => {
    for (const source of RESEARCH_SOURCE_REGISTRY) {
      const { semantics } = source;
      expect(() => researchSourceSemanticsSchema.parse(semantics)).not.toThrow();
      expect(() => researchSourceSemanticsSchema.parse(projectResearchSource(source).metadata?.semantics)).not.toThrow();
      expect(RESEARCH_SOURCE_COMMERCIAL_BIAS_LEVELS).toContain(semantics.commercialBias);
      expect(RESEARCH_SOURCE_LIFECYCLE_STATUSES).toContain(semantics.lifecycle.status);
      expect(RESEARCH_SOURCE_COVERAGE_SCOPES).toContain(semantics.coverage.scope);
      for (const country of semantics.coverage.countries ?? []) expect(country).toMatch(/^[A-Z]{2}$/);
      expect(semantics.languages.primary.length).toBeGreaterThanOrEqual(2);
      expect(RESEARCH_SIGNAL_TYPES).toContain(semantics.classification.defaultSignalType);
    }
  });

  it("rejects malformed semantics", () => {
    const valid = UK_GOV_TRAVEL_SOURCE.semantics;
    const invalid: unknown[] = [
      { ...valid, commercialBias: "extreme" },
      { ...valid, lifecycle: { status: "archived" } },
      { ...valid, coverage: { scope: "country" } },
      { ...valid, coverage: { scope: "country", countries: ["vn"] } },
      { ...valid, coverage: { scope: "city", countries: ["VN"] } },
      { ...valid, coverage: { scope: "planet" } },
      { ...valid, languages: {} },
      { ...valid, classification: { defaultSignalType: "rumor" } },
      { ...valid, primaryFor: "safety" },
    ];
    for (const value of invalid) {
      expect(researchSourceSemanticsSchema.safeParse(value).success).toBe(false);
    }
  });

  it("keeps every registry source active", () => {
    expect(RESEARCH_SOURCE_REGISTRY.map((s) => s.semantics.lifecycle)).toEqual(
      RESEARCH_SOURCE_REGISTRY.map(() => ({ status: "active" })),
    );
  });
});

describe("source semantics — source-specific values", () => {
  it("7. FCDO: no commercial bias, global advisory coverage, official entry_requirement fallback", () => {
    expect(UK_GOV_TRAVEL_SOURCE.semantics).toEqual({
      commercialBias: "none",
      coverage: { scope: "global" },
      languages: { primary: "en" },
      classification: { defaultSignalType: "entry_requirement" },
      lifecycle: { status: "active" },
    });
  });

  it("8. Vietnam: country coverage VN, destination_trend fallback, promotional tourism board bias", () => {
    expect(VIETNAM_TRAVEL_SOURCE.semantics).toEqual({
      commercialBias: "medium",
      coverage: { scope: "country", countries: ["VN"] },
      languages: { primary: "en" },
      classification: { defaultSignalType: "destination_trend" },
      lifecycle: { status: "active" },
    });
  });

  it("9. Korean trade press: ko / global / general_travel_news", () => {
    for (const source of [TRAVELTIMES_SOURCE, TRAVIE_SOURCE, TRAVELDAILY_SOURCE]) {
      expect(source.semantics).toEqual({
        commercialBias: "medium",
        coverage: { scope: "global" },
        languages: { primary: "ko" },
        classification: { defaultSignalType: "general_travel_news" },
        lifecycle: { status: "active" },
      });
    }
  });

  it("10. NYT: en / global / general_travel_news", () => {
    expect(NYT_TRAVEL_SOURCE.semantics).toEqual({
      commercialBias: "low",
      coverage: { scope: "global" },
      languages: { primary: "en" },
      classification: { defaultSignalType: "general_travel_news" },
      lifecycle: { status: "active" },
    });
  });

  it("11. Performance Memory and Meta Trend carry semantics", () => {
    expect(PERFORMANCE_MEMORY_SOURCE_DEFINITION.semantics).toEqual({
      commercialBias: "none",
      coverage: { scope: "global" },
      languages: { primary: "ko" },
      classification: { defaultSignalType: "content_performance" },
      lifecycle: { status: "active" },
    });
    expect(META_AI_TREND_SOURCE_DEFINITION.semantics).toEqual({
      commercialBias: "low",
      coverage: { scope: "global" },
      languages: { primary: "ko" },
      classification: { defaultSignalType: "destination_trend" },
      lifecycle: { status: "active" },
    });
  });
});

describe("source semantics — projection", () => {
  it("12. appends semantics as the last metadata key, cloned and JSON-safe", () => {
    for (const source of RESEARCH_SOURCE_REGISTRY) {
      const metadata = projectResearchSource(source).metadata!;
      expect(Object.keys(metadata).at(-1)).toBe("semantics");
      expect(metadata.semantics).not.toBe(source.semantics);
      expect(JSON.parse(JSON.stringify(metadata.semantics))).toStrictEqual(metadata.semantics);
    }
    const projected = projectResearchSource(VIETNAM_TRAVEL_SOURCE);
    (projected.metadata!.semantics as ResearchSourceSemantics).coverage.countries!.push("TH");
    expect(VIETNAM_TRAVEL_SOURCE.semantics.coverage.countries).toEqual(["VN"]);
  });

  it("13. keeps metadata.portfolio exactly as before (Meta still has none)", () => {
    for (const source of RESEARCH_SOURCE_REGISTRY) {
      const metadata = projectResearchSource(source).metadata!;
      if (source.kind === "push") {
        expect(metadata).not.toHaveProperty("portfolio");
      } else {
        expect(metadata.portfolio).toEqual(buildSourcePortfolioMetadata(source.portfolio, {}).portfolio);
      }
    }
  });

  it("14-15. keeps feed collectorId / feedKind; destination hints stay on the collector, not in metadata", () => {
    for (const source of EXTERNAL_RESEARCH_SOURCE_REGISTRY) {
      const metadata = projectResearchSource(source).metadata!;
      expect(metadata.collectorId).toBe(source.key);
      expect(metadata.feedKind).toBe(source.collector.feedKind);
      expect(metadata).not.toHaveProperty("destinationFocus");
    }
    expect(VIETNAM_TRAVEL_SOURCE.collector.destinationHints).toEqual(["vietnam"]);
    expect(toConfiguredRssCollectorConfig(VIETNAM_TRAVEL_SOURCE).destinationHints).toEqual(["vietnam"]);
  });

  it("16. keeps top-level source fields; semantics never leaks to the top level", () => {
    const topLevelKeys = {
      feed: ["id", "sourceType", "name", "canonicalUrl", "provider", "authorityLevel", "defaultCredibility", "locale", "country", "language", "isOfficial", "isEnabled", "metadata"],
      internal: ["id", "sourceType", "name", "authorityLevel", "defaultCredibility", "language", "isOfficial", "isEnabled", "metadata"],
      push: ["id", "sourceType", "name", "canonicalUrl", "provider", "authorityLevel", "defaultCredibility", "locale", "country", "language", "isOfficial", "isEnabled", "metadata"],
    };
    for (const source of RESEARCH_SOURCE_REGISTRY) {
      const row = projectResearchSource(source);
      expect(Object.keys(row)).toEqual(topLevelKeys[source.kind]);
      expect(row.language).toBe(source.semantics.languages.primary);
      if (source.kind !== "internal") {
        expect(row.country).toBe(source.country);
        expect(row.locale).toBe(source.locale);
      }
    }
    expect(VIETNAM_TRAVEL_SOURCE.country).toBe("VN");
    expect(projectResearchSource(UK_GOV_TRAVEL_SOURCE).country).toBe("GB");
  });
});

describe("source semantics — runtime parity", () => {
  it("17-19. collector output ignores MM-rank-only fields; raw fingerprints ignore all semantics", async () => {
    const registry = await collectAll(externalDefinitions());
    const declarative = await collectAll(externalDefinitions(MM_RANK_ONLY_PATCH));
    const altered = await collectAll(externalDefinitions(ALTERED_SEMANTICS));
    expect(registry.length).toBe(14);
    expect(canonicalSet(declarative.map((r) => r.item))).toEqual(canonicalSet(registry.map((r) => r.item)));
    expect(altered.map((r) => r.rawFingerprint)).toEqual(registry.map((r) => r.rawFingerprint));
    // Normalized fingerprints hash the resolved signalType, so only the non-classification fields are held fixed here.
    const relifecycled = await collectAll(externalDefinitions({ ...MM_RANK_ONLY_PATCH, lifecycle: ALTERED_SEMANTICS.lifecycle }));
    expect(relifecycled.map((r) => r.normalizedFingerprint)).toEqual(registry.map((r) => r.normalizedFingerprint));
  });

  it("20. declared defaultSignalType is the runtime terminal fallback of every source", async () => {
    const rows = await collectAll(externalDefinitions());
    for (const source of EXTERNAL_RESEARCH_SOURCE_REGISTRY) {
      const fallbackRow = rows.find((r) => r.key === source.key && r.item.title === FALLBACK_ITEM_TITLE_BY_KEY[source.key]);
      expect(fallbackRow?.signalType).toBe(source.semantics.classification.defaultSignalType);
    }
    for (const source of [UK_GOV_TRAVEL_SOURCE, VIETNAM_TRAVEL_SOURCE]) {
      const fallback = source.semantics.classification.defaultSignalType;
      expect(inferOfficialSignalType("Italy", "Holidays.", fallback)).toBe(fallback);
    }
    for (const source of [NYT_TRAVEL_SOURCE, TRAVELTIMES_SOURCE, TRAVIE_SOURCE, TRAVELDAILY_SOURCE]) {
      const fallback = source.semantics.classification.defaultSignalType;
      expect(inferNewsSignalType("가을 산책", "조용한 하루", fallback)).toBe(fallback);
    }
  });

  it("21. Performance feedback signals keep content_performance and the legacy portfolio", async () => {
    const perfRepo = createInMemoryContentPerformanceRepository();
    await seedPerformanceSnapshots(perfRepo);
    const repo = createInMemoryResearchRepository();
    const load = await loadPerformanceFeedbackSignals({ repo, performanceRepo: perfRepo, since: "2026-09-01T00:00:00.000Z", now: NOW });
    expect(load.signals.map((s) => s.signalType)).toEqual(["content_performance", "content_performance"]);
    expect(load.signals[0]?.signalType).toBe(PERFORMANCE_MEMORY_SOURCE_DEFINITION.semantics.classification.defaultSignalType);
    expect(resolveSourceRoleWeights(PERFORMANCE_MEMORY_SOURCE)).toEqual({
      portfolioRole: "performance_memory",
      agendaSeedWeight: 0.35,
      koreanMarketWeight: 0.7,
    });
    expect((await repo.getSourceById(PERFORMANCE_MEMORY_SOURCE.id))?.metadata?.semantics).toEqual(
      PERFORMANCE_MEMORY_SOURCE_DEFINITION.semantics,
    );
  });

  it("22. Meta push keeps the `other` fallback, 0.35 credibility and destination_trend default", async () => {
    const repo = createInMemoryResearchRepository();
    const persisted = await persistAdaptedTrend(adaptTrendSignalToResearch(FIXTURE_BUSAN_FAMILY_CRUISE, NOW), repo);
    expect(persisted.signal.credibility?.score).toBe(0.35);
    expect(persisted.agendaCandidate.compositeResearchScore).toBeCloseTo(0.5265, 6);
    expect(resolveSourceRoleWeights(buildMetaAiTrendSource(NOW)).portfolioRole).toBe("other");
    expect((await repo.getSourceById(META_AI_TREND_SOURCE_DEFINITION.id))?.metadata?.semantics).toEqual(
      META_AI_TREND_SOURCE_DEFINITION.semantics,
    );

    const unmapped = { ...FIXTURE_BUSAN_FAMILY_CRUISE, trend_type: "unmapped_future_trend" } as unknown as typeof FIXTURE_BUSAN_FAMILY_CRUISE;
    expect(adaptTrendSignalToResearch(unmapped, NOW).signal.signalType).toBe(
      META_AI_TREND_SOURCE_DEFINITION.semantics.classification.defaultSignalType,
    );
  });

  it("23. collection cycle result does not depend on MM-rank-only semantics", async () => {
    const registry = await runCycle(externalDefinitions());
    expect(registry.status).toBe("success");
    expect(await runCycle(externalDefinitions(MM_RANK_ONLY_PATCH))).toEqual(registry);
  });

  it("24. bootstrap still upserts the six feeds plus Performance Memory, now with semantics", async () => {
    const repo = createInMemoryResearchRepository();
    const returned = await bootstrapResearchSources(repo, NOW);
    expect(returned.map((s) => s.id)).toEqual([
      ...MVP_RESEARCH_SOURCES.map((s) => s.id),
      PERFORMANCE_MEMORY_SOURCE_DEFINITION.id,
    ]);
    expect(BOOTSTRAP_RESEARCH_SOURCES.some((s) => s.id === META_AI_TREND_SOURCE_DEFINITION.id)).toBe(false);
    for (const row of returned) {
      expect(row.metadata?.semantics).toEqual(RESEARCH_SOURCE_REGISTRY.find((s) => s.id === row.id)?.semantics);
      expect(withoutSemantics(row).metadata).not.toHaveProperty("semantics");
    }
  });
});

describe("source semantics — runtime readers stay scoped", () => {
  it("26. commercialBias leaves pipeline scores, role weights and MM candidate fields unchanged; only the MM rank seed reads it", async () => {
    const baseline = await runScenario(externalDefinitions({ commercialBias: "none" }));
    for (const commercialBias of RESEARCH_SOURCE_COMMERCIAL_BIAS_LEVELS) {
      const biased = await runScenario(externalDefinitions({ commercialBias }));
      expect(biased.sources.every((s) => (s.metadata?.semantics as ResearchSourceSemantics).commercialBias === commercialBias)).toBe(true);
      expect(candidateScores(biased)).toEqual(candidateScores(baseline));
      // Order-insensitive: the adjusted seed may reorder the pool, never change a candidate.
      expect(canonicalSet(biased.mm.agendaCandidates)).toEqual(canonicalSet(baseline.mm.agendaCandidates));
      expect(biased.mm.observability.articlePrePool).toEqual(baseline.mm.observability.articlePrePool);
      expect(Boolean(biased.mm.observability.agendaSeedAttenuation)).toBe(commercialBias !== "none");
    }

    for (const source of RESEARCH_SOURCE_REGISTRY) {
      const biased = projectResearchSource(withSemantics(source, { commercialBias: "high" }));
      expect(resolveSourceRoleWeights(biased)).toEqual(resolveSourceRoleWeights(projectResearchSource(source)));
    }
  });

  it("27. coverage only fills geography of items that resolve none; hints and families never follow it", async () => {
    const baseline = await runScenario(externalDefinitions());
    const rescoped = await runScenario(
      externalDefinitions({ coverage: { scope: "country", countries: ["JP"] } }),
    );
    expect(rescoped.sources.every((s) => (s.metadata?.semantics as ResearchSourceSemantics).coverage.countries?.[0] === "JP")).toBe(true);
    expect(baseline.pipeline.agendaCandidates.some((c) => destinationTopicFamilyKey(c).startsWith("destination:"))).toBe(true);
    expect(rescoped.collected.map((r) => r.item.destinationHints)).toEqual(baseline.collected.map((r) => r.item.destinationHints));
    expect(baseline.collected.every((r) => r.signal?.geography.length === 0)).toBe(true);
    for (const [i, row] of rescoped.collected.entries()) {
      const base = baseline.collected[i]!;
      const fallback = COVERAGE_FALLBACK_TITLES.includes(row.item.title);
      expect([row.item.title, row.signal?.geography]).toEqual([row.item.title, fallback ? ["jp"] : base.signal?.geography]);
      expect(row.rawFingerprint).toBe(base.rawFingerprint);
      if (!fallback) expect(row.normalizedFingerprint).toBe(base.normalizedFingerprint);
    }
    const families = (result: typeof baseline) =>
      result.pipeline.agendaCandidates.map((c) => [c.title, destinationTopicFamilyKey(c)]).sort();
    expect(families(rescoped)).toEqual(families(baseline));
    expect(candidateScores(rescoped)).toEqual(candidateScores(baseline));

    const vietnamItems = rescoped.collected.filter((r) => r.key === VIETNAM_TRAVEL_SOURCE.key);
    expect(vietnamItems.every((r) => r.item.destinationHints?.includes("vietnam"))).toBe(true);
    expect(toConfiguredRssCollectorConfig(withSemantics(VIETNAM_TRAVEL_SOURCE, { coverage: { scope: "global" } })).destinationHints).toEqual([
      "vietnam",
    ]);
  });

  it("28. languages.primary supplies the signal fallback; raw registry items have no stamped language", async () => {
    const baseline = await collectAll(externalDefinitions());
    const relabeled = await collectAll(externalDefinitions({ languages: { primary: "vi" } }));
    const sourceByKey = new Map(EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((s) => [s.key, s]));
    expect(baseline.every((r) => r.signal?.language === sourceByKey.get(r.key)!.semantics.languages.primary)).toBe(true);
    expect(baseline.every((r) => r.item.language === null && r.signal?.metadata?.languageFallbackApplied === true)).toBe(true);
    expect(relabeled.map((r) => [r.item.language, r.signal?.language ?? null])).toEqual(relabeled.map(() => [null, "vi"]));
    expect(relabeled.map((r) => [r.item.locale, r.signalType, r.rawFingerprint])).toEqual(
      baseline.map((r) => [r.item.locale, r.signalType, r.rawFingerprint]),
    );
    expect([...baseline, ...relabeled].every((r) => r.signal?.metadata?.languageFallbackApplied === true)).toBe(true);
    for (const source of EXTERNAL_RESEARCH_SOURCE_REGISTRY) {
      const row = projectResearchSource(withSemantics(source, { languages: { primary: "vi" } }));
      expect([row.language, row.locale]).toEqual(["vi", source.locale]);
    }
  });

  it("languages.content has no runtime reader; commercialBias, coverage and languages.primary have one each; semantics readers are allowlisted", () => {
    const srcRoot = path.resolve(__dirname, "../../../..");
    const declarationFiles = new Set([
      "lib/marketing/research/sources/sourceRegistry.ts",
      "lib/marketing/research/types/sourceSemantics.ts",
      "lib/marketing/research/validation.ts",
    ]);
    const runtimeFiles = (readdirSync(srcRoot, { recursive: true }) as string[])
      .filter((file) => /\.(ts|tsx)$/.test(file) && !/__tests__|\.test\.|\.spec\./.test(file))
      .map((file) => file.split(path.sep).join("/"))
      .filter((file) => !declarationFiles.has(file))
      .map((file) => ({ file, text: readFileSync(path.join(srcRoot, file), "utf8") }));

    const filesMatching = (pattern: RegExp) => runtimeFiles.filter(({ text }) => pattern.test(text)).map(({ file }) => file);
    // The retention table, the formula and the semantics read live in one module ...
    expect(
      filesMatching(
        /semantics\??\.commercialBias\b|\{\s*commercialBias\?:\s*unknown|\bRESEARCH_SOURCE_COMMERCIAL_BIAS_LEVELS\b|\bCOMMERCIAL_BIAS_AGENDA_SEED_RETENTION\b|\badjustAgendaSeedForCommercialBias\b|\bresolveCommercialBias\b/,
      ),
    ).toEqual(["lib/marketing/research/sourceCommercialBias.ts"]);
    // ... consumed only by the MM final-rank seed; scoring, corroboration, outbound and pre-pool never mention it.
    expect(filesMatching(/research\/sourceCommercialBias["']/)).toEqual([
      "lib/marketing/research/manager/getMarketingManagerResearchContext.ts",
    ]);
    expect(filesMatching(/\bcommercialBias\b|\bResearchSourceCommercialBias\b/).sort()).toEqual([
      "lib/marketing/research/manager/getMarketingManagerResearchContext.ts",
      "lib/marketing/research/manager/types.ts",
      "lib/marketing/research/sourceCommercialBias.ts",
    ]);

    const languagesReaders = runtimeFiles.filter(({ text }) =>
      /semantics\??\.languages\b|\{\s*languages\?:\s*unknown|\bResearchSourceLanguages\w*\b|\blanguages\??\.(primary|content)\b/.test(text),
    );
    expect(languagesReaders.map(({ file }) => file)).toEqual(["lib/marketing/research/sourceLanguage.ts"]);
    const contentReaders = runtimeFiles.filter(
      ({ text }) => /\blanguages\??\.content\b|\blanguages\b[^;]*\[\s*["']content["']\s*\]/.test(text),
    );
    expect(contentReaders.map(({ file }) => file)).toEqual([]);
    expect(languagesReaders.every(({ text }) => !/\bcontent\b/.test(text))).toBe(true);

    const coverageReaders = runtimeFiles.filter(({ text }) =>
      /semantics\??\.coverage\b|\{\s*coverage\?:|\bResearchSourceCoverage\w*\b|\bRESEARCH_SOURCE_COVERAGE_SCOPES\b/.test(text),
    );
    expect(coverageReaders.map(({ file }) => file)).toEqual(["lib/marketing/research/sourceCoverage.ts"]);

    const semanticsReaders = runtimeFiles
      .filter(({ text }) => /\.semantics\b|\[\s*["']semantics["']\s*\]/.test(text))
      .map(({ file }) => file)
      .sort();
    expect(semanticsReaders).toEqual([
      "lib/marketing/research/collectors/nytTravelRssCollector.ts",
      "lib/marketing/research/collectors/ukGovTravelAdviceCollector.ts",
      "lib/marketing/research/sourceCommercialBias.ts",
      "lib/marketing/research/sourceCoverage.ts",
      "lib/marketing/research/sourceLanguage.ts",
      "lib/marketing/research/sourceLifecycle.ts",
      "lib/marketing/trends/adapter/trendSourceAdapter.ts",
    ]);
  });
});
