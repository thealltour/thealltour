import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createInMemoryContentPerformanceRepository } from "@/lib/marketing/performance/repository/inMemoryContentPerformanceRepository";
import {
  RESEARCH_SOURCE_LIFECYCLE_STATUSES,
  type ResearchSourceLifecycleStatus,
} from "@/lib/marketing/research";
import { bootstrapResearchSources } from "@/lib/marketing/research/collection/bootstrapSources";
import { runResearchCollectionCycle } from "@/lib/marketing/research/collection/runResearchCollectionCycle";
import {
  BOOTSTRAP_RESEARCH_SOURCES,
  EXTERNAL_RESEARCH_SOURCE_REGISTRY,
  META_AI_TREND_SOURCE_DEFINITION,
  NYT_TRAVEL_SOURCE,
  PERFORMANCE_MEMORY_SOURCE_DEFINITION,
  RESEARCH_SOURCE_REGISTRY,
  UK_GOV_TRAVEL_SOURCE,
  VIETNAM_TRAVEL_SOURCE,
  createDefaultResearchCollectors,
  createResearchCollectorForSource,
  mapRawResearchItemToSignalInput,
  projectResearchSource,
  type ExternalResearchSourceDefinition,
  type ResearchSourceDefinition,
} from "@/lib/marketing/research/collectors";
import { getMarketingManagerResearchContext } from "@/lib/marketing/research/manager/getMarketingManagerResearchContext";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import { normalizeResearchSignal } from "@/lib/marketing/research/services/normalizer";
import { runResearchPipeline } from "@/lib/marketing/research/services/pipeline";
import {
  SOURCE_LIFECYCLE_INACTIVE,
  canCollectResearchSource,
  canSourceParticipateInCandidates,
  canSourceParticipateInMm,
  resolveSourceLifecycleStatus,
} from "@/lib/marketing/research/sourceLifecycle";
import type { ResearchSignalType } from "@/lib/marketing/research/types/enums";
import type { RawResearchSignalInput } from "@/lib/marketing/research/types/researchSignal";
import {
  adaptTrendSignalToResearch,
  buildMetaAiTrendSource,
  persistAdaptedTrend,
} from "@/lib/marketing/trends/adapter/trendSourceAdapter";
import {
  FIXTURE_BUSAN_FAMILY_CRUISE,
  FIXTURE_PARENTS_FIRST_TAIWAN,
  FIXTURE_VIETNAM_FAMILY_GROUP,
} from "@/lib/marketing/trends/fixtures/positiveFixtures";
import { createInMemoryTravelTrendsStagingRepository } from "@/lib/marketing/trends/staging/inMemoryTravelTrendsStagingRepository";
import { processNewTrendStagingObservations } from "@/lib/marketing/trends/staging/processNewTrendStaging";
import type { TrendSignalPayloadV1 } from "@/lib/marketing/trends/types";
import {
  PARITY_FIXTURE_BY_FEED,
  mockFeedFetch,
  withoutSemantics,
} from "@/lib/marketing/research/__tests__/sourceRegistryParityFixtures";

/** One clock for every A/B run: MM context depends on `now`, not on semantics. */
const NOW = new Date("2026-10-01T09:00:00.000Z");
const ISO = NOW.toISOString();
const EPOCH = "1970-01-01T00:00:00.000Z";
const ENABLED_ENV = { RESEARCH_COLLECTION_ENABLED: "true" };
const INACTIVE_STATUSES = ["paused", "retired"] as const;

const REGISTRY_IDS = new Set(RESEARCH_SOURCE_REGISTRY.map((s) => s.id));
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VOLATILE_KEYS = new Set(["id", "createdAt", "updatedAt", "startedAt", "completedAt", "cycleId", "durationMs"]);

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

function withLifecycle<T extends ResearchSourceDefinition>(source: T, status: ResearchSourceLifecycleStatus): T {
  const clone = structuredClone(source);
  clone.semantics.lifecycle = { status };
  return clone;
}

function withDefaultSignalType<T extends ResearchSourceDefinition>(source: T, defaultSignalType: ResearchSignalType): T {
  const clone = structuredClone(source);
  clone.semantics.classification = { defaultSignalType };
  return clone;
}

function replaceSource(
  target: ResearchSourceDefinition,
  next: ResearchSourceDefinition | null,
): ResearchSourceDefinition[] {
  return RESEARCH_SOURCE_REGISTRY.flatMap((source) => (source.id === target.id ? (next ? [next] : []) : [source]));
}

async function snapshotRepo(repo: ResearchRepository) {
  return {
    signals: await repo.findRecentSignals({ since: EPOCH, limit: 10_000 }),
    candidates: await repo.findRecentAgendaCandidates({ since: EPOCH, limit: 10_000 }),
    briefs: await repo.findActiveBriefs(10_000),
  };
}

async function runMm(repo: ResearchRepository, now: Date = NOW) {
  return getMarketingManagerResearchContext(
    { lookbackHours: 168, limit: 30 },
    { repo, now, checkSemanticInfrastructure: async () => false },
  );
}

/** Rows the MM pre-pool excluded by lifecycle, read from its `article_prepool` log event. */
async function prePoolLifecycleExcluded(run: () => Promise<unknown>): Promise<number> {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  try {
    await run();
    const events = info.mock.calls
      .filter(([tag]) => tag === "[mm-research-context]")
      .map(([, payload]) => JSON.parse(String(payload)) as { event?: string; sourceLifecycleExcludedRows?: number })
      .filter((event) => event.event === "article_prepool");
    expect(events).toHaveLength(1);
    return events[0]!.sourceLifecycleExcludedRows ?? -1;
  } finally {
    info.mockRestore();
  }
}

async function runCycleScenario(
  sources: readonly ResearchSourceDefinition[],
  options: {
    repo?: ResearchRepository;
    performanceRepo?: ReturnType<typeof createInMemoryContentPerformanceRepository>;
  } = {},
) {
  const repo = options.repo ?? createInMemoryResearchRepository();
  const cycle = await runResearchCollectionCycle({
    repo,
    now: NOW,
    env: ENABLED_ENV,
    sources,
    collectors: createDefaultResearchCollectors({ fetchImpl: mockFeedFetch(PARITY_FIXTURE_BY_FEED) }, sources),
    performanceRepo: options.performanceRepo,
  });
  const mm = await runMm(repo);
  return { repo, cycle, mm, ...(await snapshotRepo(repo)) };
}

type Scenario = Awaited<ReturnType<typeof runCycleScenario>>;

function sourceIdsOfBrief(result: Pick<Scenario, "briefs">, briefId: string): string[] {
  return result.briefs.find((b) => b.id === briefId)?.evidence.map((e) => e.sourceId) ?? [];
}

function candidatesTouching(result: Scenario, sourceId: string) {
  return result.candidates.filter((c) => sourceIdsOfBrief(result, c.researchBriefId).includes(sourceId));
}

function candidateView(result: Scenario) {
  return canonicalSet(result.cycle.pipeline?.agendaCandidates ?? []);
}

function mmView(result: { mm: Scenario["mm"] }) {
  return {
    status: result.mm.status,
    notes: result.mm.notes,
    candidates: canonicalSet(result.mm.agendaCandidates),
    briefs: canonicalSet(result.mm.briefs),
  };
}

function collectorView(result: Scenario, excludeSourceId?: string) {
  return result.cycle.collectorResults
    .filter((r) => r.sourceId !== excludeSourceId)
    .map((r) => stable(r));
}

// Fingerprint/classification probes use active rows; participation gates are tested by cycle scenarios.
async function collectAll(definitions: readonly ExternalResearchSourceDefinition[]) {
  const rows = [];
  for (const source of definitions) {
    const collector = createResearchCollectorForSource(source, { fetchImpl: mockFeedFetch(PARITY_FIXTURE_BY_FEED) });
    const items = await collector.collect({ sourceId: source.id, sourceType: source.sourceType, now: NOW, maxItems: 25 });
    for (const item of items) {
      const mapped = mapRawResearchItemToSignalInput(item, { sourceId: source.id, sourceType: source.sourceType });
      const normalized = mapped
        ? normalizeResearchSignal(mapped, { ...projectResearchSource({ ...source, semantics: { ...source.semantics, lifecycle: { status: "active" } } }), createdAt: ISO, updatedAt: ISO }, NOW)
        : null;
      rows.push({
        key: source.key,
        title: item.title,
        item,
        mapped,
        signalType: mapped?.signalType ?? null,
        rawFingerprint: normalized?.ok ? normalized.signal.rawFingerprint : null,
        normalizedFingerprint: normalized?.ok ? normalized.signal.normalizedFingerprint : null,
      });
    }
  }
  return rows;
}

async function seededPerformanceRepo() {
  const repo = createInMemoryContentPerformanceRepository();
  for (const [i, origin] of (["human_edited", "ai_unchanged"] as const).entries()) {
    await repo.save({
      snapshot: {
        collectionId: `pcol_lifecycle_${i}`,
        logicalObservationKey: `lifecycle-obs-${i}`,
        candidateId: `cmc_lifecycle_${i}`,
        humanReviewId: `hmr_lifecycle_${i}`,
        platform: "threads",
        channel: "threads",
        externalPostId: `lifecycle_post_${i}`,
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
  return repo;
}

/** Phase 3A signal types of the parity fixtures, by feed and item title. */
const PHASE_3A_SIGNAL_TYPES: Record<string, Record<string, ResearchSignalType>> = {
  "uk-gov-travel-advice": { Japan: "entry_requirement", Thailand: "safety", Italy: "entry_requirement" },
  "nyt-travel-rss": { "How to Plan a Trip to Spain": "hotel_resort", "A Long Weekend in Lisbon": "general_travel_news" },
  "traveltimes-rss": {
    "추석 앞두고 도쿄권 태풍 변수…275편 결항 뒤 상황은": "general_travel_news",
    "가을엔 3대가 함께 코타키나발루로": "general_travel_news",
  },
  "travie-rss": {
    "추석 앞두고 도쿄권 태풍 변수…275편 결항 뒤 상황은": "general_travel_news",
    "가을엔 3대가 함께 코타키나발루로": "general_travel_news",
  },
  "traveldaily-rss": {
    "추석 앞두고 도쿄권 태풍 변수…275편 결항 뒤 상황은": "general_travel_news",
    "가을엔 3대가 함께 코타키나발루로": "general_travel_news",
  },
  "vietnam-travel-rss": {
    "A celestial journey through Vietnam": "destination_trend",
    "Vietnam extends e-visa validity": "entry_requirement",
    "New flight connects Da Nang and Busan": "flight_route",
  },
};

/** Items no source-specific rule resolves; only these may follow `defaultSignalType`. */
const TERMINAL_FALLBACK_TITLES: Record<string, string[]> = {
  "uk-gov-travel-advice": ["Italy"],
  "nyt-travel-rss": ["A Long Weekend in Lisbon"],
  "traveltimes-rss": ["추석 앞두고 도쿄권 태풍 변수…275편 결항 뒤 상황은", "가을엔 3대가 함께 코타키나발루로"],
  "travie-rss": ["추석 앞두고 도쿄권 태풍 변수…275편 결항 뒤 상황은", "가을엔 3대가 함께 코타키나발루로"],
  "traveldaily-rss": ["추석 앞두고 도쿄권 태풍 변수…275편 결항 뒤 상황은", "가을엔 3대가 함께 코타키나발루로"],
  "vietnam-travel-rss": ["A celestial journey through Vietnam"],
};

describe("source lifecycle policy helper", () => {
  it("maps each status to the collection / candidate / MM participation matrix", () => {
    const matrix = Object.fromEntries(
      RESEARCH_SOURCE_LIFECYCLE_STATUSES.map((status) => {
        const definition = withLifecycle(NYT_TRAVEL_SOURCE, status);
        return [status, [canCollectResearchSource(definition), canSourceParticipateInCandidates(definition), canSourceParticipateInMm(definition)]];
      }),
    );
    expect(matrix).toEqual({
      active: [true, true, true],
      shadow: [true, false, false],
      paused: [false, false, false],
      retired: [false, false, false],
    });
  });

  it("reads the same status from a definition and from its projected row", () => {
    for (const status of RESEARCH_SOURCE_LIFECYCLE_STATUSES) {
      const definition = withLifecycle(VIETNAM_TRAVEL_SOURCE, status);
      expect(resolveSourceLifecycleStatus(definition)).toBe(status);
      expect(resolveSourceLifecycleStatus(projectResearchSource(definition))).toBe(status);
    }
  });

  it("treats rows without valid lifecycle semantics as unresolved and inactive", () => {
    expect(resolveSourceLifecycleStatus(null)).toBeNull();
    expect(resolveSourceLifecycleStatus(withoutSemantics(projectResearchSource(NYT_TRAVEL_SOURCE)))).toBeNull();
    expect(resolveSourceLifecycleStatus({ metadata: { semantics: { lifecycle: { status: "archived" } } } })).toBeNull();
    expect(resolveSourceLifecycleStatus({ metadata: { semantics: "paused" } })).toBeNull();
  });
});

describe("7.1 registry semantics as-is reproduce Phase 3A", () => {
  it("pins the Phase 3A signal type of every fixture item of the six feeds", async () => {
    const rows = await collectAll(EXTERNAL_RESEARCH_SOURCE_REGISTRY);
    const actual: Record<string, Record<string, ResearchSignalType | null>> = {};
    for (const row of rows) (actual[row.key] ??= {})[row.title] = row.signalType;
    expect(actual).toEqual(PHASE_3A_SIGNAL_TYPES);
    expect(actual["uk-gov-travel-advice"]?.Thailand).toBe("safety");
  });

  it("Performance and Meta keep content_performance / destination_trend", async () => {
    const result = await runCycleScenario(RESEARCH_SOURCE_REGISTRY, { performanceRepo: await seededPerformanceRepo() });
    expect(
      result.signals.filter((s) => s.sourceId === PERFORMANCE_MEMORY_SOURCE_DEFINITION.id).map((s) => s.signalType),
    ).toEqual(["content_performance", "content_performance"]);
    for (const fixture of [FIXTURE_BUSAN_FAMILY_CRUISE, FIXTURE_PARENTS_FIRST_TAIWAN, FIXTURE_VIETNAM_FAMILY_GROUP]) {
      expect(adaptTrendSignalToResearch(fixture, NOW).signal.signalType).toBe("destination_trend");
    }
  });

  it("an explicit registry catalog behaves exactly like the default catalog", async () => {
    const performanceRepo = await seededPerformanceRepo();
    const run = async (sources?: readonly ResearchSourceDefinition[]) => {
      const repo = createInMemoryResearchRepository();
      const cycle = await runResearchCollectionCycle({
        repo,
        now: NOW,
        env: ENABLED_ENV,
        ...(sources ? { sources } : {}),
        collectors: createDefaultResearchCollectors({ fetchImpl: mockFeedFetch(PARITY_FIXTURE_BY_FEED) }, sources),
        performanceRepo,
      });
      return {
        cycle: stable({ ...cycle, pipeline: undefined }),
        candidates: canonicalSet(cycle.pipeline?.agendaCandidates ?? []),
        signals: canonicalSet((await snapshotRepo(repo)).signals),
        mm: mmView({ mm: await runMm(repo) }),
        sources: canonicalSet(await repo.listEnabledSources()),
      };
    };
    const baseline = await run();
    expect(baseline.candidates.length).toBeGreaterThan(0);
    expect(await run(RESEARCH_SOURCE_REGISTRY.map((s) => structuredClone(s)))).toEqual(baseline);
  });
});

describe("7.2 defaultSignalType is the terminal fallback only", () => {
  it("changes exactly the items no rule resolved; resolved items keep their type", async () => {
    const baseline = await collectAll(EXTERNAL_RESEARCH_SOURCE_REGISTRY);
    const mutated = await collectAll(EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((s) => withDefaultSignalType(s, "safety")));
    expect(mutated.map((r) => [r.key, r.title])).toEqual(baseline.map((r) => [r.key, r.title]));

    const changed: Record<string, string[]> = {};
    mutated.forEach((row, index) => {
      const before = baseline[index]!;
      if (row.signalType !== before.signalType) {
        expect(row.signalType).toBe("safety");
        (changed[row.key] ??= []).push(row.title);
      }
    });
    expect(changed).toEqual(TERMINAL_FALLBACK_TITLES);
  });

  it("Vietnam destination_trend → safety: only the editorial fallback item follows", async () => {
    const [baseline, mutated] = await Promise.all([
      collectAll([VIETNAM_TRAVEL_SOURCE]),
      collectAll([withDefaultSignalType(VIETNAM_TRAVEL_SOURCE, "safety")]),
    ]);
    expect(baseline.map((r) => r.signalType)).toEqual(["destination_trend", "entry_requirement", "flight_route"]);
    expect(mutated.map((r) => r.signalType)).toEqual(["safety", "entry_requirement", "flight_route"]);
    expect(mutated.map((r) => r.item.metadata?.signalTypeFallbackApplied)).toEqual([true, false, false]);
  });

  it("FCDO keyword items never consult the fallback", async () => {
    const mutated = await collectAll([withDefaultSignalType(UK_GOV_TRAVEL_SOURCE, "weather")]);
    expect(Object.fromEntries(mutated.map((r) => [r.title, r.signalType]))).toEqual({
      Japan: "entry_requirement",
      Thailand: "safety",
      Italy: "weather",
    });
  });

  it("the mutated fallback reaches persisted signals through the cycle", async () => {
    const mutatedNyt = withDefaultSignalType(NYT_TRAVEL_SOURCE, "destination_trend");
    const result = await runCycleScenario(replaceSource(NYT_TRAVEL_SOURCE, mutatedNyt));
    const nyt = Object.fromEntries(
      result.signals.filter((s) => s.sourceId === NYT_TRAVEL_SOURCE.id).map((s) => [s.title, s.signalType]),
    );
    expect(nyt).toEqual({
      "how to plan a trip to spain": "hotel_resort",
      "a long weekend in lisbon": "destination_trend",
    });
  });

  it("Performance signal type is explicit and ignores defaultSignalType", async () => {
    const mutatedPerf = withDefaultSignalType(PERFORMANCE_MEMORY_SOURCE_DEFINITION, "safety");
    const result = await runCycleScenario(replaceSource(PERFORMANCE_MEMORY_SOURCE_DEFINITION, mutatedPerf), {
      performanceRepo: await seededPerformanceRepo(),
    });
    expect(
      result.signals.filter((s) => s.sourceId === PERFORMANCE_MEMORY_SOURCE_DEFINITION.id).map((s) => s.signalType),
    ).toEqual(["content_performance", "content_performance"]);
  });

  it("Meta: unknown trend_type follows the fallback; explicit mappings never do", () => {
    const unmapped = { ...FIXTURE_BUSAN_FAMILY_CRUISE, trend_type: "unmapped_future_trend" } as unknown as TrendSignalPayloadV1;
    const fare = { ...FIXTURE_BUSAN_FAMILY_CRUISE, trend_type: "fare_price_signal" } as TrendSignalPayloadV1;
    const mutatedMeta = withDefaultSignalType(META_AI_TREND_SOURCE_DEFINITION, "safety");

    expect(adaptTrendSignalToResearch(unmapped, NOW).signal.signalType).toBe("destination_trend");
    expect(adaptTrendSignalToResearch(unmapped, NOW, mutatedMeta).signal.signalType).toBe("safety");
    for (const explicit of [FIXTURE_BUSAN_FAMILY_CRUISE, FIXTURE_PARENTS_FIRST_TAIWAN, FIXTURE_VIETNAM_FAMILY_GROUP]) {
      expect(adaptTrendSignalToResearch(explicit, NOW, mutatedMeta).signal.signalType).toBe("destination_trend");
    }
    expect(adaptTrendSignalToResearch(fare, NOW, mutatedMeta).signal.signalType).toBe("airfare");
  });
});

describe("8. lifecycle A/B on a feed source (NYT)", () => {
  async function scenarios() {
    const active = await runCycleScenario(RESEARCH_SOURCE_REGISTRY);
    const absent = await runCycleScenario(replaceSource(NYT_TRAVEL_SOURCE, null));
    return { active, absent };
  }

  it("active baseline: NYT is collected and produces candidates and MM inputs", async () => {
    const { active } = await scenarios();
    expect(active.signals.some((s) => s.sourceId === NYT_TRAVEL_SOURCE.id)).toBe(true);
    expect(candidatesTouching(active, NYT_TRAVEL_SOURCE.id).length).toBeGreaterThan(0);
    expect(active.mm.briefs.some((b) => b.evidence.some((e) => e.sourceId === NYT_TRAVEL_SOURCE.id))).toBe(true);
  });

  it("shadow: collected and persisted like active, but candidate/MM output equals NYT being absent", async () => {
    const { active, absent } = await scenarios();
    const shadow = await runCycleScenario(replaceSource(NYT_TRAVEL_SOURCE, withLifecycle(NYT_TRAVEL_SOURCE, "shadow")));

    const nytResult = (s: Scenario) => s.cycle.collectorResults.find((r) => r.sourceId === NYT_TRAVEL_SOURCE.id);
    expect(nytResult(shadow)).toMatchObject({ status: "success", itemsObserved: nytResult(active)?.itemsObserved, errors: [] });

    const nytFingerprints = (s: Scenario) =>
      s.signals.filter((x) => x.sourceId === NYT_TRAVEL_SOURCE.id).map((x) => x.rawFingerprint).sort();
    expect(nytFingerprints(shadow).length).toBeGreaterThan(0);
    expect(nytFingerprints(shadow)).toEqual(nytFingerprints(active));

    expect(candidatesTouching(shadow, NYT_TRAVEL_SOURCE.id)).toEqual([]);
    expect(shadow.briefs.some((b) => b.evidence.some((e) => e.sourceId === NYT_TRAVEL_SOURCE.id))).toBe(false);
    expect(candidateView(shadow)).toEqual(candidateView(absent));
    expect(mmView(shadow)).toEqual(mmView(absent));
    expect(collectorView(shadow, NYT_TRAVEL_SOURCE.id)).toEqual(collectorView(absent));
    expect(shadow.cycle.totals.accepted).toBe(absent.cycle.totals.accepted + nytFingerprints(shadow).length);
  });

  for (const status of INACTIVE_STATUSES) {
    it(`${status}: catalog row kept, collector not run, no signals/candidates/MM; others equal NYT absent`, async () => {
      const { absent } = await scenarios();
      const requested: string[] = [];
      const sources = replaceSource(NYT_TRAVEL_SOURCE, withLifecycle(NYT_TRAVEL_SOURCE, status));
      const repo = createInMemoryResearchRepository();
      const cycle = await runResearchCollectionCycle({
        repo,
        now: NOW,
        env: ENABLED_ENV,
        sources,
        collectors: createDefaultResearchCollectors({ fetchImpl: mockFeedFetch(PARITY_FIXTURE_BY_FEED, requested) }, sources),
      });
      const inactive: Scenario = { repo, cycle, mm: await runMm(repo), ...(await snapshotRepo(repo)) };

      expect(requested).not.toContain(NYT_TRAVEL_SOURCE.feedUrl);
      expect(cycle.collectorResults.find((r) => r.sourceId === NYT_TRAVEL_SOURCE.id)).toMatchObject({
        collectorId: NYT_TRAVEL_SOURCE.key,
        status: "skipped",
        itemsObserved: 0,
        errors: [{ code: SOURCE_LIFECYCLE_INACTIVE }],
      });
      const row = await repo.getSourceById(NYT_TRAVEL_SOURCE.id);
      expect(row?.metadata?.semantics).toMatchObject({ lifecycle: { status } });
      expect(row?.isEnabled).toBe(false);

      expect(inactive.signals.filter((s) => s.sourceId === NYT_TRAVEL_SOURCE.id)).toEqual([]);
      expect(candidatesTouching(inactive, NYT_TRAVEL_SOURCE.id)).toEqual([]);
      expect(candidateView(inactive)).toEqual(candidateView(absent));
      expect(mmView(inactive)).toEqual(mmView(absent));
      expect(collectorView(inactive, NYT_TRAVEL_SOURCE.id)).toEqual(collectorView(absent));
    });
  }

  it("retired behaves exactly like paused at runtime", async () => {
    const run = async (status: ResearchSourceLifecycleStatus) => {
      const result = await runCycleScenario(replaceSource(NYT_TRAVEL_SOURCE, withLifecycle(NYT_TRAVEL_SOURCE, status)));
      return {
        candidates: candidateView(result),
        signals: canonicalSet(result.signals),
        mm: mmView(result),
        collectors: result.cycle.collectorResults.map((r) => [r.collectorId, r.status, r.errors.map((e) => e.code)]),
        totals: result.cycle.totals,
      };
    };
    expect(await run("retired")).toEqual(await run("paused"));
  });

  it("a shadow source sharing items with active sources neither merges into nor corroborates them", async () => {
    const korean = EXTERNAL_RESEARCH_SOURCE_REGISTRY.find((s) => s.key === "traveltimes-rss")!;
    const shadow = await runCycleScenario(replaceSource(korean, withLifecycle(korean, "shadow")));
    const absent = await runCycleScenario(replaceSource(korean, null));
    expect(shadow.briefs.some((b) => b.evidence.some((e) => e.sourceId === korean.id))).toBe(false);
    expect(shadow.signals.filter((s) => s.sourceId === korean.id).length).toBeGreaterThan(0);
    expect(candidateView(shadow)).toEqual(candidateView(absent));
    expect(mmView(shadow)).toEqual(mmView(absent));
  });

  it("direct pipeline callers cannot persist signals of an inactive source", async () => {
    for (const status of INACTIVE_STATUSES) {
      const definition = withLifecycle(NYT_TRAVEL_SOURCE, status);
      const repo = createInMemoryResearchRepository();
      await repo.upsertSource({ ...projectResearchSource(definition), createdAt: ISO, updatedAt: ISO });
      const rawSignals = (await collectAll([NYT_TRAVEL_SOURCE])).map((r) =>
        mapRawResearchItemToSignalInput(r.item, { sourceId: NYT_TRAVEL_SOURCE.id, sourceType: NYT_TRAVEL_SOURCE.sourceType }),
      ).filter((s): s is RawResearchSignalInput => s !== null);
      const pipeline = await runResearchPipeline({ repo, rawSignals, now: NOW });
      expect(pipeline.rejected.map((r) => r.reason)).toEqual(rawSignals.map(() => SOURCE_LIFECYCLE_INACTIVE));
      expect(pipeline.normalized).toEqual([]);
      expect((await snapshotRepo(repo)).signals).toEqual([]);
    }
  });
});

describe("9. lifecycle never purges historical rows", () => {
  for (const status of ["shadow", ...INACTIVE_STATUSES] as const) {
    it(`${status}: pre-existing NYT signals/briefs/candidates survive and leave MM`, async () => {
      const seeded = await runCycleScenario(RESEARCH_SOURCE_REGISTRY);
      const before = structuredClone(await snapshotRepo(seeded.repo));
      const nytCandidatesBefore = candidatesTouching(seeded, NYT_TRAVEL_SOURCE.id);
      expect(nytCandidatesBefore.length).toBeGreaterThan(0);

      let after!: Scenario;
      const excluded = await prePoolLifecycleExcluded(async () => {
        after = await runCycleScenario(
          replaceSource(NYT_TRAVEL_SOURCE, withLifecycle(NYT_TRAVEL_SOURCE, status)),
          { repo: seeded.repo },
        );
      });

      const ids = (rows: Array<{ id: string }>) => new Set(rows.map((r) => r.id));
      for (const key of ["signals", "candidates", "briefs"] as const) {
        const afterIds = ids(after[key]);
        expect(before[key].every((row) => afterIds.has(row.id))).toBe(true);
      }
      for (const candidate of nytCandidatesBefore) {
        expect(await seeded.repo.findAgendaCandidateById(candidate.id)).toEqual(candidate);
      }
      if (status !== "shadow") {
        expect(after.signals.filter((s) => s.sourceId === NYT_TRAVEL_SOURCE.id)).toEqual(
          before.signals.filter((s) => s.sourceId === NYT_TRAVEL_SOURCE.id),
        );
      }

      expect(after.mm.briefs.some((b) => b.evidence.some((e) => e.sourceId === NYT_TRAVEL_SOURCE.id))).toBe(false);
      expect(excluded).toBe(nytCandidatesBefore.length);
      expect(after.mm.notes.some((n) => n.startsWith("source_lifecycle_excluded:"))).toBe(false);
      expect(after.mm.agendaCandidates.length).toBeGreaterThan(0);
    });
  }

  it("reactivating the source makes its historical candidates MM-eligible again", async () => {
    const seeded = await runCycleScenario(RESEARCH_SOURCE_REGISTRY);
    await runCycleScenario(replaceSource(NYT_TRAVEL_SOURCE, withLifecycle(NYT_TRAVEL_SOURCE, "paused")), {
      repo: seeded.repo,
    });
    let reactivated!: Scenario;
    const excluded = await prePoolLifecycleExcluded(async () => {
      reactivated = await runCycleScenario(RESEARCH_SOURCE_REGISTRY, { repo: seeded.repo });
    });
    expect(excluded).toBe(0);
    expect(reactivated.mm.notes.some((n) => n.startsWith("source_lifecycle_excluded:"))).toBe(false);
    expect(reactivated.mm.briefs.some((b) => b.evidence.some((e) => e.sourceId === NYT_TRAVEL_SOURCE.id))).toBe(true);
  });
});

describe("10. lifecycle status reaches projected and persisted source rows", () => {
  for (const status of RESEARCH_SOURCE_LIFECYCLE_STATUSES) {
    it(`${status}: every catalog row is still bootstrapped, carrying the status`, async () => {
      const sources = RESEARCH_SOURCE_REGISTRY.map((s) => withLifecycle(s, status));
      const repo = createInMemoryResearchRepository();
      const rows = await bootstrapResearchSources(repo, NOW, sources);
      expect(rows.map((r) => r.id)).toEqual(BOOTSTRAP_RESEARCH_SOURCES.map((r) => r.id));
      for (const row of rows) {
        const stored = await repo.getSourceById(row.id);
        expect(stored?.metadata?.semantics).toMatchObject({ lifecycle: { status } });
        expect(withoutSemantics(stored)).toEqual(
          withoutSemantics({ ...BOOTSTRAP_RESEARCH_SOURCES.find((r) => r.id === row.id)!, isEnabled: status === "active" || status === "shadow", createdAt: ISO, updatedAt: ISO }),
        );
      }
      expect(buildMetaAiTrendSource(NOW, withLifecycle(META_AI_TREND_SOURCE_DEFINITION, status)).metadata?.semantics)
        .toMatchObject({ lifecycle: { status } });
    });
  }

  it("bootstrap without an explicit catalog is unchanged", async () => {
    const repo = createInMemoryResearchRepository();
    const rows = await bootstrapResearchSources(repo, NOW);
    expect(rows).toEqual(BOOTSTRAP_RESEARCH_SOURCES.map((row) => ({ ...row, createdAt: ISO, updatedAt: ISO })));
  });
});

describe("11. Performance Memory and Meta Trend lifecycle", () => {
  const perfSignals = (s: Scenario) => s.signals.filter((x) => x.sourceId === PERFORMANCE_MEMORY_SOURCE_DEFINITION.id);
  const perfResult = (s: Scenario) =>
    s.cycle.collectorResults.find((r) => r.sourceId === PERFORMANCE_MEMORY_SOURCE_DEFINITION.id);

  it("Performance active: content_performance signals, success result", async () => {
    const active = await runCycleScenario(RESEARCH_SOURCE_REGISTRY, { performanceRepo: await seededPerformanceRepo() });
    expect(perfSignals(active).map((s) => s.signalType)).toEqual(["content_performance", "content_performance"]);
    expect(perfResult(active)).toMatchObject({ status: "success", itemsAccepted: 2 });
  });

  it("Performance shadow: persisted, kept shadow on the row, no candidate influence", async () => {
    const shadowPerf = withLifecycle(PERFORMANCE_MEMORY_SOURCE_DEFINITION, "shadow");
    const shadow = await runCycleScenario(replaceSource(PERFORMANCE_MEMORY_SOURCE_DEFINITION, shadowPerf), {
      performanceRepo: await seededPerformanceRepo(),
    });
    const withoutPerf = await runCycleScenario(RESEARCH_SOURCE_REGISTRY);
    expect(perfSignals(shadow).map((s) => s.signalType)).toEqual(["content_performance", "content_performance"]);
    expect(perfResult(shadow)).toMatchObject({ status: "success", itemsAccepted: 2 });
    expect((await shadow.repo.getSourceById(PERFORMANCE_MEMORY_SOURCE_DEFINITION.id))?.metadata?.semantics)
      .toMatchObject({ lifecycle: { status: "shadow" } });
    expect(candidatesTouching(shadow, PERFORMANCE_MEMORY_SOURCE_DEFINITION.id)).toEqual([]);
    expect(candidateView(shadow)).toEqual(candidateView(withoutPerf));
    expect(mmView(shadow)).toEqual(mmView(withoutPerf));
  });

  for (const status of INACTIVE_STATUSES) {
    it(`Performance ${status}: loader skipped, row kept with status, no signals`, async () => {
      const inactivePerf = withLifecycle(PERFORMANCE_MEMORY_SOURCE_DEFINITION, status);
      const result = await runCycleScenario(replaceSource(PERFORMANCE_MEMORY_SOURCE_DEFINITION, inactivePerf), {
        performanceRepo: await seededPerformanceRepo(),
      });
      const withoutPerf = await runCycleScenario(RESEARCH_SOURCE_REGISTRY);
      expect(perfSignals(result)).toEqual([]);
      expect(perfResult(result)).toMatchObject({
        collectorId: PERFORMANCE_MEMORY_SOURCE_DEFINITION.key,
        status: "skipped",
        errors: [{ code: SOURCE_LIFECYCLE_INACTIVE }],
      });
      expect(result.cycle.totals.performanceSnapshots).toBe(0);
      expect((await result.repo.getSourceById(PERFORMANCE_MEMORY_SOURCE_DEFINITION.id))?.metadata?.semantics)
        .toMatchObject({ lifecycle: { status } });
      expect(candidateView(result)).toEqual(candidateView(withoutPerf));
    });
  }

  it("Meta persist: active writes all rows; shadow stops after the signal; paused/retired write the source only", async () => {
    const outcomes: Record<string, unknown> = {};
    for (const status of RESEARCH_SOURCE_LIFECYCLE_STATUSES) {
      const definition = withLifecycle(META_AI_TREND_SOURCE_DEFINITION, status);
      const repo = createInMemoryResearchRepository();
      const adapted = adaptTrendSignalToResearch(FIXTURE_BUSAN_FAMILY_CRUISE, NOW, definition);
      const persisted = await persistAdaptedTrend(adapted, repo);
      outcomes[status] = {
        flags: persisted.persisted,
        sourceStatus: resolveSourceLifecycleStatus(await repo.getSourceById(META_AI_TREND_SOURCE_DEFINITION.id)),
        signal: (await repo.findByFingerprint(adapted.signal.rawFingerprint)) !== null,
        brief: (await repo.findBriefById(adapted.brief.id)) !== null,
        candidates: (await snapshotRepo(repo)).candidates.length,
      };
    }
    expect(outcomes).toEqual({
      active: { flags: { signal: true, brief: true, agendaCandidate: true }, sourceStatus: "active", signal: true, brief: true, candidates: 1 },
      shadow: { flags: { signal: true, brief: false, agendaCandidate: false }, sourceStatus: "shadow", signal: true, brief: false, candidates: 0 },
      paused: { flags: { signal: false, brief: false, agendaCandidate: false }, sourceStatus: "paused", signal: false, brief: false, candidates: 0 },
      retired: { flags: { signal: false, brief: false, agendaCandidate: false }, sourceStatus: "retired", signal: false, brief: false, candidates: 0 },
    });
  });

  it("Meta staging: shadow ingests rows without brief ids; paused leaves rows NEW and refreshes the catalog row", async () => {
    const seedStaging = () => {
      const staging = createInMemoryTravelTrendsStagingRepository();
      staging.seed(FIXTURE_BUSAN_FAMILY_CRUISE);
      staging.seed(FIXTURE_PARENTS_FIRST_TAIWAN);
      return staging;
    };

    const activeStaging = seedStaging();
    const activeRepo = createInMemoryResearchRepository();
    const active = await processNewTrendStagingObservations({ stagingRepo: activeStaging, researchRepo: activeRepo, now: NOW });
    expect(active).toMatchObject({ adaptedTrendCount: 2, degradeReason: null });
    expect(active.researchBriefIds).toHaveLength(2);

    const shadowStaging = seedStaging();
    const shadowRepo = createInMemoryResearchRepository();
    const shadow = await processNewTrendStagingObservations({
      stagingRepo: shadowStaging,
      researchRepo: shadowRepo,
      now: NOW,
      metaSource: withLifecycle(META_AI_TREND_SOURCE_DEFINITION, "shadow"),
    });
    expect(shadow).toMatchObject({ availableTrendCount: 2, adaptedTrendCount: 2, researchBriefIds: [], degradeReason: null });
    expect(await shadowStaging.countNewTrendObservations()).toBe(0);
    expect((await snapshotRepo(shadowRepo)).signals).toHaveLength(2);
    expect((await snapshotRepo(shadowRepo)).candidates).toHaveLength(0);

    for (const status of INACTIVE_STATUSES) {
      const staging = seedStaging();
      const repo = createInMemoryResearchRepository();
      const diagnostics = await processNewTrendStagingObservations({
        stagingRepo: staging,
        researchRepo: repo,
        now: NOW,
        metaSource: withLifecycle(META_AI_TREND_SOURCE_DEFINITION, status),
      });
      expect(diagnostics).toMatchObject({
        availableTrendCount: 2,
        adaptedTrendCount: 0,
        failedCount: 0,
        discardedCount: 0,
        researchBriefIds: [],
        degradeReason: SOURCE_LIFECYCLE_INACTIVE,
      });
      expect(await staging.countNewTrendObservations()).toBe(2);
      expect(resolveSourceLifecycleStatus(await repo.getSourceById(META_AI_TREND_SOURCE_DEFINITION.id))).toBe(status);
      expect((await snapshotRepo(repo)).signals).toEqual([]);
    }
  });

  it("Meta MM: historical Meta candidates leave MM once the catalog row is paused", async () => {
    // Inside the fixture's 72h freshness window.
    const metaNow = new Date("2026-09-06T06:00:00.000Z");
    const repo = createInMemoryResearchRepository();
    await persistAdaptedTrend(adaptTrendSignalToResearch(FIXTURE_BUSAN_FAMILY_CRUISE, metaNow), repo);
    const metaIn = (mm: Awaited<ReturnType<typeof runMm>>) =>
      mm.briefs.some((b) => b.evidence.some((e) => e.sourceId === META_AI_TREND_SOURCE_DEFINITION.id));
    expect(metaIn(await runMm(repo, metaNow))).toBe(true);

    await repo.upsertSource(buildMetaAiTrendSource(metaNow, withLifecycle(META_AI_TREND_SOURCE_DEFINITION, "paused")));
    let paused!: Awaited<ReturnType<typeof runMm>>;
    const excluded = await prePoolLifecycleExcluded(async () => {
      paused = await runMm(repo, metaNow);
    });
    expect(metaIn(paused)).toBe(false);
    expect(excluded).toBe(1);
    expect((await snapshotRepo(repo)).candidates).toHaveLength(1);
  });
});

describe("13. fingerprints do not read semantics", () => {
  it("raw fingerprints are identical under every semantics mutation", async () => {
    const baseline = await collectAll(EXTERNAL_RESEARCH_SOURCE_REGISTRY);
    const mutations: Array<(s: ExternalResearchSourceDefinition) => ExternalResearchSourceDefinition> = [
      (s) => withDefaultSignalType(s, "safety"),
      (s) => withLifecycle(s, "shadow"),
      (s) => withLifecycle(withDefaultSignalType(s, "weather"), "retired"),
    ];
    for (const mutate of mutations) {
      const mutated = await collectAll(EXTERNAL_RESEARCH_SOURCE_REGISTRY.map(mutate));
      expect(mutated.map((r) => r.rawFingerprint)).toEqual(baseline.map((r) => r.rawFingerprint));
    }
  });

  it("normalized fingerprints ignore lifecycle and only see the resolved signalType", async () => {
    const baseline = await collectAll(EXTERNAL_RESEARCH_SOURCE_REGISTRY);
    const shadow = await collectAll(EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((s) => withLifecycle(s, "retired")));
    expect(shadow.map((r) => r.normalizedFingerprint)).toEqual(baseline.map((r) => r.normalizedFingerprint));

    const mutatedSources = EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((s) => withDefaultSignalType(s, "safety"));
    const mutated = await collectAll(mutatedSources);
    mutated.forEach((row, index) => {
      const before = baseline[index]!;
      const isFallback = TERMINAL_FALLBACK_TITLES[row.key]?.includes(row.title) ?? false;
      expect(row.normalizedFingerprint === before.normalizedFingerprint).toBe(!isFallback);
      const source = mutatedSources.find((s) => s.key === row.key)!;
      const restored = normalizeResearchSignal(
        { ...row.mapped!, signalType: before.signalType! },
        { ...projectResearchSource(source), createdAt: ISO, updatedAt: ISO },
        NOW,
      );
      expect(restored.ok && restored.signal.normalizedFingerprint).toBe(before.normalizedFingerprint);
    });
  });

  it("persisted fingerprints of shadow sources equal their active fingerprints", async () => {
    const active = await runCycleScenario(RESEARCH_SOURCE_REGISTRY);
    const shadow = await runCycleScenario(RESEARCH_SOURCE_REGISTRY.map((s) => withLifecycle(s, "shadow")));
    const prints = (s: Scenario) => s.signals.map((x) => [x.rawFingerprint, x.normalizedFingerprint].join("|")).sort();
    expect(prints(shadow)).toEqual(prints(active));
  });
});
