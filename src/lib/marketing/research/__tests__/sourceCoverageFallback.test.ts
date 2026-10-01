import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createInMemoryContentPerformanceRepository } from "@/lib/marketing/performance/repository/inMemoryContentPerformanceRepository";
import type { ResearchSourceCoverage } from "@/lib/marketing/research";
import {
  PARITY_FIXTURE_BY_FEED,
  VN_RSS_PARITY,
  mockFeedFetch,
  withoutSemantics,
} from "@/lib/marketing/research/__tests__/sourceRegistryParityFixtures";
import { loadPerformanceFeedbackSignals } from "@/lib/marketing/research/collection/loadPerformanceFeedbackSignals";
import {
  EXTERNAL_RESEARCH_SOURCE_REGISTRY,
  META_AI_TREND_SOURCE_DEFINITION,
  PERFORMANCE_MEMORY_SOURCE_DEFINITION,
  VIETNAM_TRAVEL_SOURCE,
  createResearchCollectorForSource,
  mapRawResearchItemToSignalInput,
  projectResearchSource,
  type ExternalResearchSourceDefinition,
  type ResearchSourceDefinition,
} from "@/lib/marketing/research/collectors";
import { computeNormalizedFingerprint } from "@/lib/marketing/research/fingerprint";
import { getMarketingManagerResearchContext } from "@/lib/marketing/research/manager/getMarketingManagerResearchContext";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import { destinationTopicFamilyKey } from "@/lib/marketing/research/services/diversifyAgendaCandidatesForCuration";
import { normalizeResearchSignal } from "@/lib/marketing/research/services/normalizer";
import { runResearchPipeline } from "@/lib/marketing/research/services/pipeline";
import {
  coverageTerminalGeography,
  resolveSignalGeography,
  resolveSourceCoverage,
} from "@/lib/marketing/research/sourceCoverage";
import type { RawResearchSignalInput, ResearchSignal } from "@/lib/marketing/research/types/researchSignal";
import { adaptTrendSignalToResearch } from "@/lib/marketing/trends/adapter/trendSourceAdapter";
import { FIXTURE_BUSAN_FAMILY_CRUISE } from "@/lib/marketing/trends/fixtures/positiveFixtures";

const NOW = new Date("2026-10-01T09:00:00.000Z");
const ISO = NOW.toISOString();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGISTRY_IDS = new Set(EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((s) => s.id));

/** Titles no place keyword resolves. */
const UNRESOLVED = ["Lantern evenings by the river", "Celebrating the lunar new year"];
/** Titles whose own text names a destination. */
const RESOLVED = ["Cherry blossom weekends in Japan", "New flight connects Da Nang and Busan", "Hanoi street food night walk"];

const VN_COVERAGE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Vietnam Travel</title>
    <item>
      <title>Lantern evenings by the river</title>
      <link>https://vietnam.travel/stories/lantern-evenings</link>
      <pubDate>Wed, 30 Sep 2026 03:00:00 GMT</pubDate>
      <description>Slow evenings of lanterns, street food and riverside music.</description>
    </item>
    <item>
      <title>Celebrating the lunar new year</title>
      <link>https://vietnam.travel/stories/lunar-new-year</link>
      <pubDate>Wed, 30 Sep 2026 02:00:00 GMT</pubDate>
      <description>Family traditions, flower markets and festive dishes.</description>
    </item>
    <item>
      <title>Cherry blossom weekends in Japan</title>
      <link>https://vietnam.travel/stories/cherry-blossom-japan</link>
      <pubDate>Tue, 29 Sep 2026 03:00:00 GMT</pubDate>
      <description>Where to see spring blossoms near Tokyo this season.</description>
    </item>
    <item>
      <title>New flight connects Da Nang and Busan</title>
      <link>https://vietnam.travel/news/da-nang-busan</link>
      <pubDate>Mon, 28 Sep 2026 03:00:00 GMT</pubDate>
      <description>Service begins next month with daily departures.</description>
    </item>
    <item>
      <title>Hanoi street food night walk</title>
      <link>https://vietnam.travel/stories/hanoi-night-walk</link>
      <pubDate>Sun, 27 Sep 2026 03:00:00 GMT</pubDate>
      <description>Noodle stalls and coffee corners after dark.</description>
    </item>
  </channel>
</rss>`;

const VN_COVERAGE_FIXTURE = { ...PARITY_FIXTURE_BY_FEED, [VIETNAM_TRAVEL_SOURCE.feedUrl]: VN_COVERAGE_FEED };

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, ["id", "createdAt", "updatedAt"].includes(k) ? "<volatile>" : stable(v)]),
    );
  }
  if (typeof value === "string" && UUID_PATTERN.test(value) && !REGISTRY_IDS.has(value)) return "<uuid>";
  return value;
}

function withCoverage<T extends ResearchSourceDefinition>(source: T, coverage: ResearchSourceCoverage): T {
  const clone = structuredClone(source);
  clone.semantics.coverage = coverage;
  return clone;
}

function sourceRow(definition: ResearchSourceDefinition) {
  return { ...projectResearchSource(definition), createdAt: ISO, updatedAt: ISO };
}

type CollectedSignal = { key: string; title: string; mapped: RawResearchSignalInput; signal: ResearchSignal };

async function collectSignals(
  definition: ExternalResearchSourceDefinition,
  options: { fixture?: Record<string, string>; legacyRow?: boolean } = {},
): Promise<CollectedSignal[]> {
  const collector = createResearchCollectorForSource(definition, {
    fetchImpl: mockFeedFetch(options.fixture ?? VN_COVERAGE_FIXTURE),
  });
  const items = await collector.collect({ sourceId: definition.id, sourceType: definition.sourceType, now: NOW, maxItems: 25 });
  // Isolate absence of coverage from lifecycle readiness (which is now fail-closed).
  const row = sourceRow(definition);
  if (options.legacyRow) row.metadata = { ...row.metadata, semantics: { ...definition.semantics, coverage: undefined } };
  const out: CollectedSignal[] = [];
  for (const item of items) {
    const mapped = mapRawResearchItemToSignalInput(item, { sourceId: definition.id, sourceType: definition.sourceType });
    if (!mapped) continue;
    const normalized = normalizeResearchSignal(mapped, row, NOW);
    if (!normalized.ok) continue;
    out.push({ key: definition.key, title: item.title, mapped, signal: normalized.signal });
  }
  return out;
}

const byTitle = (rows: CollectedSignal[]) => new Map(rows.map((r) => [r.title, r]));

/** Same item, minus wall-clock / random fields and its evidence ids. */
function view(row: CollectedSignal | undefined) {
  return stable(row?.signal);
}

/** Every field the coverage fallback may change, removed. */
function viewWithoutGeography(row: CollectedSignal | undefined) {
  if (!row) return undefined;
  const signal: Record<string, unknown> = { ...row.signal, metadata: { ...(row.signal.metadata ?? {}) } };
  delete signal.geography;
  delete signal.normalizedFingerprint;
  delete (signal.metadata as Record<string, unknown>).geographyFallbackApplied;
  return stable(signal);
}

const VN_COUNTRY = VIETNAM_TRAVEL_SOURCE;
const VN_GLOBAL = withCoverage(VIETNAM_TRAVEL_SOURCE, { scope: "global" });
const VN_AS_JP = withCoverage(VIETNAM_TRAVEL_SOURCE, { scope: "country", countries: ["JP"] });

describe("coverage terminal fallback — helper", () => {
  it("maps each scope to a fallback only for exactly one declared country or city", () => {
    const cases: Array<[ResearchSourceCoverage | null, string[]]> = [
      [null, []],
      [{ scope: "global" }, []],
      [{ scope: "country", countries: ["VN"] }, ["VN"]],
      [{ scope: "country", countries: ["VN", "TH"] }, []],
      [{ scope: "multi_country", countries: ["VN", "TH"] }, []],
      [{ scope: "multi_country", countries: ["VN"] }, []],
      [{ scope: "city", cities: ["Da Nang"] }, ["Da Nang"]],
      [{ scope: "city", cities: ["Da Nang", "Hoi An"] }, []],
      [{ scope: "city", countries: ["VN"], cities: ["Da Nang", "Hoi An"] }, []],
    ];
    for (const [coverage, expected] of cases) {
      expect(coverageTerminalGeography(coverage)).toEqual(expected);
    }
  });

  it("reads coverage from a definition and its projected row; missing or malformed coverage is null", () => {
    expect(resolveSourceCoverage(VIETNAM_TRAVEL_SOURCE)).toEqual({ scope: "country", countries: ["VN"] });
    expect(resolveSourceCoverage(sourceRow(VIETNAM_TRAVEL_SOURCE))).toEqual({ scope: "country", countries: ["VN"] });
    expect(resolveSourceCoverage(withoutSemantics(sourceRow(VIETNAM_TRAVEL_SOURCE)))).toBeNull();
    expect(resolveSourceCoverage(null)).toBeNull();
    expect(resolveSourceCoverage({ metadata: { semantics: { coverage: { scope: "planet" } } } })).toBeNull();
    expect(resolveSourceCoverage({ metadata: { semantics: { coverage: { scope: "country", countries: "VN" } } } })).toBeNull();
  });

  it("explicit item geography wins, a named destination blocks the fallback, otherwise coverage fills in", () => {
    const vn = sourceRow(VIETNAM_TRAVEL_SOURCE);
    expect(resolveSignalGeography({ geography: ["JP"], title: "Lantern evenings" }, vn)).toEqual({
      geography: ["JP"],
      coverageFallbackApplied: false,
    });
    expect(resolveSignalGeography({ geography: [], title: "Cherry blossom weekends in Japan" }, vn)).toEqual({
      geography: [],
      coverageFallbackApplied: false,
    });
    expect(resolveSignalGeography({ geography: [], title: "Lantern evenings", entities: ["osaka"] }, vn)).toEqual({
      geography: [],
      coverageFallbackApplied: false,
    });
    expect(resolveSignalGeography({ geography: [], title: "Lantern evenings" }, vn)).toEqual({
      geography: ["VN"],
      coverageFallbackApplied: true,
    });
  });
});

describe("coverage terminal fallback — Vietnam", () => {
  it("A. inference-failure items fall back to VN; the pre-coverage result was unresolved", async () => {
    const before = byTitle(await collectSignals(VN_COUNTRY, { legacyRow: true }));
    const after = byTitle(await collectSignals(VN_COUNTRY));
    for (const title of UNRESOLVED) {
      expect(before.get(title)?.signal.geography).toEqual([]);
      expect(after.get(title)?.signal.geography).toEqual(["vn"]);
      expect(after.get(title)?.signal.metadata).toMatchObject({ geographyFallbackApplied: true });
      expect(viewWithoutGeography(after.get(title))).toEqual(viewWithoutGeography(before.get(title)));
    }
    expect(stable(await collectSignals(VN_GLOBAL))).toEqual(stable(await collectSignals(VN_COUNTRY, { legacyRow: true })));
  });

  it("B. mutating coverage to JP moves only the inference-failure items to JP", async () => {
    const vn = byTitle(await collectSignals(VN_COUNTRY));
    const jp = byTitle(await collectSignals(VN_AS_JP));
    for (const title of UNRESOLVED) {
      expect(jp.get(title)?.signal.geography).toEqual(["jp"]);
      expect(viewWithoutGeography(jp.get(title))).toEqual(viewWithoutGeography(vn.get(title)));
    }
    for (const title of RESOLVED) {
      expect(view(jp.get(title))).toEqual(view(vn.get(title)));
    }
  });

  it("10. items naming a destination are identical under every coverage, explicit Japan included", async () => {
    const variants: ResearchSourceCoverage[] = [
      { scope: "country", countries: ["VN"] },
      { scope: "country", countries: ["JP"] },
      { scope: "global" },
      { scope: "multi_country", countries: ["VN", "TH"] },
      { scope: "city", cities: ["Da Nang"] },
    ];
    const baseline = byTitle(await collectSignals(VN_COUNTRY, { legacyRow: true }));
    for (const coverage of variants) {
      const rows = byTitle(await collectSignals(withCoverage(VIETNAM_TRAVEL_SOURCE, coverage)));
      for (const title of RESOLVED) {
        expect(rows.get(title)?.signal.geography).toEqual([]);
        expect(view(rows.get(title))).toEqual(view(baseline.get(title)));
      }
    }
    const japan = baseline.get("Cherry blossom weekends in Japan")!.signal;
    expect(japan.destinations).toContain("cherry-blossom-weekends-in-japan");
  });

  it("destination hints, destinations and signal types never follow coverage", async () => {
    const vn = await collectSignals(VN_COUNTRY);
    const jp = await collectSignals(VN_AS_JP);
    const legacy = await collectSignals(VN_COUNTRY, { legacyRow: true });
    const pick = (rows: CollectedSignal[]) => rows.map((r) => [r.title, r.signal.destinations, r.signal.signalType, r.mapped.destinations]);
    expect(pick(vn)).toEqual(pick(legacy));
    expect(pick(jp)).toEqual(pick(legacy));
    expect(vn.every((r) => r.signal.destinations.includes("vietnam"))).toBe(true);
  });
});

describe("coverage terminal fallback — parity and ambiguity", () => {
  it("11. global sources and the current production fixture are unchanged", async () => {
    for (const source of EXTERNAL_RESEARCH_SOURCE_REGISTRY) {
      const current = await collectSignals(source, { fixture: PARITY_FIXTURE_BY_FEED });
      const legacy = await collectSignals(source, { fixture: PARITY_FIXTURE_BY_FEED, legacyRow: true });
      expect(current.length).toBeGreaterThan(0);
      expect(stable(current)).toEqual(stable(legacy));
      expect(current.every((r) => r.signal.geography.length === 0)).toBe(true);
    }
    const nyt = byTitle(
      await collectSignals(EXTERNAL_RESEARCH_SOURCE_REGISTRY.find((s) => s.key === "nyt-travel-rss")!, { fixture: PARITY_FIXTURE_BY_FEED }),
    );
    expect(nyt.get("A Long Weekend in Lisbon")?.signal.geography).toEqual([]);
    expect(VN_RSS_PARITY).toContain("Da Nang");
  });

  it("12. multi_country and multi-country `country` coverage never pick a country", async () => {
    const legacy = await collectSignals(VN_COUNTRY, { legacyRow: true });
    for (const coverage of [
      { scope: "multi_country", countries: ["VN", "TH"] },
      { scope: "multi_country", countries: ["TH", "VN"] },
      { scope: "country", countries: ["VN", "TH"] },
    ] satisfies ResearchSourceCoverage[]) {
      const rows = await collectSignals(withCoverage(VIETNAM_TRAVEL_SOURCE, coverage));
      expect(rows.every((r) => r.signal.geography.length === 0)).toBe(true);
      expect(stable(rows)).toEqual(stable(legacy));
    }
  });

  it("13. single-city coverage falls back to the city; named cities stay; several cities never fall back", async () => {
    const city = byTitle(await collectSignals(withCoverage(VIETNAM_TRAVEL_SOURCE, { scope: "city", cities: ["Da Nang"] })));
    for (const title of UNRESOLVED) expect(city.get(title)?.signal.geography).toEqual(["da nang"]);
    expect(city.get("Hanoi street food night walk")?.signal.geography).toEqual([]);
    expect(city.get("Hanoi street food night walk")?.signal.destinations).toContain("hanoi-street-food-night-walk");

    const cities = await collectSignals(withCoverage(VIETNAM_TRAVEL_SOURCE, { scope: "city", cities: ["Da Nang", "Hoi An"] }));
    expect(stable(cities)).toEqual(stable(await collectSignals(VN_COUNTRY, { legacyRow: true })));
  });

  it("17. raw fingerprints ignore coverage; normalized fingerprints move only with the resolved geography", async () => {
    const legacy = byTitle(await collectSignals(VN_COUNTRY, { legacyRow: true }));
    for (const definition of [VN_COUNTRY, VN_AS_JP, VN_GLOBAL]) {
      const rows = byTitle(await collectSignals(definition));
      for (const [title, row] of rows) {
        const base = legacy.get(title)!.signal;
        expect(row.signal.rawFingerprint).toBe(base.rawFingerprint);
        if (row.signal.geography.length === 0) {
          expect(row.signal.normalizedFingerprint).toBe(base.normalizedFingerprint);
        } else {
          expect(row.signal.normalizedFingerprint).not.toBe(base.normalizedFingerprint);
          expect(row.signal.normalizedFingerprint).toBe(
            computeNormalizedFingerprint({
              signalType: row.signal.signalType,
              title: row.signal.title,
              claim: row.signal.claim,
              destinations: row.signal.destinations,
              geography: row.signal.geography,
            }),
          );
        }
      }
    }
  });
});

describe("coverage terminal fallback — downstream", () => {
  async function scenario(vietnam: ExternalResearchSourceDefinition) {
    const definitions = EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((s) => (s.id === vietnam.id ? vietnam : s));
    const repo = createInMemoryResearchRepository();
    for (const source of definitions) await repo.upsertSource(sourceRow(source));
    const rawSignals: RawResearchSignalInput[] = [];
    for (const source of definitions) rawSignals.push(...(await collectSignals(source)).map((r) => r.mapped));
    const pipeline = await runResearchPipeline({ repo, rawSignals, now: NOW });
    const mm = await getMarketingManagerResearchContext(
      { lookbackHours: 168, limit: 30 },
      { repo, now: NOW, checkSemanticInfrastructure: async () => false },
    );
    return { pipeline, mm };
  }

  it("14/15. fallback items change geography only: scores, families, candidates and MM context are unchanged", async () => {
    const withFallback = await scenario(VN_COUNTRY);
    const withoutFallback = await scenario(VN_GLOBAL);
    const fallbackSignals = withFallback.pipeline.normalized.filter((s) => s.geography.includes("vn"));
    expect(fallbackSignals.map((s) => s.title).sort()).toEqual(UNRESOLVED.map((t) => t.toLowerCase()).sort());
    expect(withoutFallback.pipeline.normalized.every((s) => s.geography.length === 0)).toBe(true);

    const candidateView = (r: typeof withFallback) =>
      r.pipeline.agendaCandidates
        .map((c) => JSON.stringify(stable({ ...c, family: destinationTopicFamilyKey(c) })))
        .sort();
    expect(withFallback.pipeline.agendaCandidates.length).toBeGreaterThan(0);
    expect(candidateView(withFallback)).toEqual(candidateView(withoutFallback));
    expect(stable(withFallback.mm)).toEqual(stable(withoutFallback.mm));
  });

  it("18. Performance memory (global) keeps empty geography; Meta keeps its explicit KR geography", async () => {
    const perfRepo = createInMemoryContentPerformanceRepository();
    await perfRepo.save({
      snapshot: {
        collectionId: "pcol_coverage",
        logicalObservationKey: "coverage-obs",
        candidateId: "cmc_coverage",
        humanReviewId: "hmr_coverage",
        platform: "threads",
        channel: "threads",
        externalPostId: "coverage_post",
        publishedAt: "2026-09-30T10:00:00.000Z",
        publicationSource: "manual",
        contentOrigin: "human_edited",
        collectionStatus: "success",
        observedAt: "2026-10-01T01:00:00.000Z",
        dataAvailability: "available",
        topic: "가을 여행 성과",
        destinations: [],
        format: "thread",
        commercialIntent: "awareness",
        productLinked: false,
        sampleQuality: "single_post_sample",
      },
      metrics: [{ metricType: "impressions", metricValue: 900 }],
    });
    const repo = createInMemoryResearchRepository();
    const load = await loadPerformanceFeedbackSignals({ repo, performanceRepo: perfRepo, since: "2026-09-01T00:00:00.000Z", now: NOW });
    const perfSignals = (await runResearchPipeline({ repo, rawSignals: load.signals, now: NOW })).normalized.filter(
      (s) => s.sourceId === PERFORMANCE_MEMORY_SOURCE_DEFINITION.id,
    );
    expect(load.signals.map((s) => s.signalType)).toEqual(["content_performance"]);
    expect(perfSignals.length).toBeGreaterThan(0);
    expect(perfSignals.every((s) => s.geography.length === 0 && !s.metadata?.geographyFallbackApplied)).toBe(true);

    const metaDefault = adaptTrendSignalToResearch(FIXTURE_BUSAN_FAMILY_CRUISE, NOW);
    const metaScoped = adaptTrendSignalToResearch(
      FIXTURE_BUSAN_FAMILY_CRUISE,
      NOW,
      withCoverage(META_AI_TREND_SOURCE_DEFINITION, { scope: "country", countries: ["JP"] }),
    );
    expect(metaDefault.signal.geography).toEqual(["KR"]);
    expect(stable(metaScoped.signal)).toEqual(stable(metaDefault.signal));
    expect(stable(metaScoped.agendaCandidate)).toEqual(stable(metaDefault.agendaCandidate));
  });
});
