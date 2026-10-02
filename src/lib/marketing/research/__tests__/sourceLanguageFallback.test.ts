import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createInMemoryContentPerformanceRepository } from "@/lib/marketing/performance/repository/inMemoryContentPerformanceRepository";
import type { ResearchSourceLanguages } from "@/lib/marketing/research";
import {
  PARITY_FIXTURE_BY_FEED,
  mockFeedFetch,
  withoutSemantics,
} from "@/lib/marketing/research/__tests__/sourceRegistryParityFixtures";
import { loadPerformanceFeedbackSignals } from "@/lib/marketing/research/collection/loadPerformanceFeedbackSignals";
import {
  EXTERNAL_RESEARCH_SOURCE_REGISTRY,
  META_AI_TREND_SOURCE_DEFINITION,
  NYT_TRAVEL_SOURCE,
  PERFORMANCE_MEMORY_SOURCE_DEFINITION,
  RESEARCH_SOURCE_REGISTRY,
  TRAVELTIMES_SOURCE,
  VIETNAM_TRAVEL_SOURCE,
  createConfiguredRssCollector,
  createResearchCollectorForSource,
  mapRawResearchItemToSignalInput,
  projectResearchSource,
  toConfiguredRssCollectorConfig,
  type ExternalResearchSourceDefinition,
  type RawResearchItem,
  type ResearchCollector,
  type ResearchSourceDefinition,
} from "@/lib/marketing/research/collectors";
import { getMarketingManagerResearchContext } from "@/lib/marketing/research/manager/getMarketingManagerResearchContext";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import { destinationTopicFamilyKey } from "@/lib/marketing/research/services/diversifyAgendaCandidatesForCuration";
import { normalizeResearchSignal } from "@/lib/marketing/research/services/normalizer";
import { runResearchPipeline } from "@/lib/marketing/research/services/pipeline";
import {
  UNRESOLVED_SIGNAL_LANGUAGE,
  deriveLegacySourceLanguage,
  resolveSignalLanguage,
  resolveSourcePrimaryLanguage,
} from "@/lib/marketing/research/sourceLanguage";
import type { RawResearchSignalInput, ResearchSignal } from "@/lib/marketing/research/types/researchSignal";
import { adaptTrendSignalToResearch } from "@/lib/marketing/trends/adapter/trendSourceAdapter";
import { FIXTURE_BUSAN_FAMILY_CRUISE } from "@/lib/marketing/trends/fixtures/positiveFixtures";

const NOW = new Date("2026-10-01T09:00:00.000Z");
const ISO = NOW.toISOString();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGISTRY_IDS = new Set(EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((s) => s.id));

/** Two items without a place name, one naming a destination. */
const VN_LANGUAGE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
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
      <title>Hanoi street food night walk</title>
      <link>https://vietnam.travel/stories/hanoi-night-walk</link>
      <pubDate>Sun, 27 Sep 2026 03:00:00 GMT</pubDate>
      <description>Noodle stalls and coffee corners after dark.</description>
    </item>
  </channel>
</rss>`;

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

function withLanguages<T extends ResearchSourceDefinition>(source: T, languages: ResearchSourceLanguages): T {
  const clone = structuredClone(source);
  clone.semantics.languages = languages;
  return clone;
}

function sourceRow(definition: ResearchSourceDefinition) {
  return { ...projectResearchSource(definition), createdAt: ISO, updatedAt: ISO };
}

/** Generic-profile collector whose config carries no language, so every item leaves it unresolved. */
function languagelessCollector(definition: ExternalResearchSourceDefinition, fixture: Record<string, string>): ResearchCollector {
  const config = { ...toConfiguredRssCollectorConfig(definition) };
  delete config.language;
  return createConfiguredRssCollector(config, { fetchImpl: mockFeedFetch(fixture) });
}

/** Registry collector whose items have their collector-stamped language removed. */
function strippedCollector(definition: ExternalResearchSourceDefinition, fixture: Record<string, string>): ResearchCollector {
  const inner = createResearchCollectorForSource(definition, { fetchImpl: mockFeedFetch(fixture) });
  return {
    ...inner,
    async collect(context) {
      return (await inner.collect(context)).map((item): RawResearchItem => ({ ...item, language: null }));
    },
  };
}

type CollectMode = "registry" | "languageless" | "stripped";
type CollectedSignal = { title: string; item: RawResearchItem; mapped: RawResearchSignalInput; signal: ResearchSignal };

async function collectSignals(
  definition: ExternalResearchSourceDefinition,
  options: { mode?: CollectMode; fixture?: Record<string, string>; legacyRow?: boolean } = {},
): Promise<CollectedSignal[]> {
  const fixture = options.fixture ?? PARITY_FIXTURE_BY_FEED;
  const mode = options.mode ?? "registry";
  const collector =
    mode === "languageless"
      ? languagelessCollector(definition, fixture)
      : mode === "stripped"
        ? strippedCollector(definition, fixture)
        : createResearchCollectorForSource(definition, { fetchImpl: mockFeedFetch(fixture) });
  const items = await collector.collect({ sourceId: definition.id, sourceType: definition.sourceType, now: NOW, maxItems: 25 });
  // Isolate absence of primary from lifecycle readiness; whole missing semantics is tested separately.
  const row = sourceRow(definition);
  if (options.legacyRow) row.metadata = { ...row.metadata, semantics: { ...definition.semantics, languages: undefined } };
  const out: CollectedSignal[] = [];
  for (const item of items) {
    const mapped = mapRawResearchItemToSignalInput(item, { sourceId: definition.id, sourceType: definition.sourceType });
    if (!mapped) continue;
    const normalized = normalizeResearchSignal(mapped, row, NOW);
    if (!normalized.ok) continue;
    out.push({ title: item.title, item, mapped, signal: normalized.signal });
  }
  return out;
}

/** Signal minus every field the language fallback may change. */
function viewWithoutLanguage(row: CollectedSignal | ResearchSignal | undefined) {
  if (!row) return undefined;
  const source = "signal" in row ? row.signal : row;
  const signal: Record<string, unknown> = { ...source, metadata: { ...(source.metadata ?? {}) } };
  delete signal.language;
  delete (signal.metadata as Record<string, unknown>).languageFallbackApplied;
  return stable(signal);
}

function rawSignal(overrides: Partial<RawResearchSignalInput> & Record<string, unknown> = {}): RawResearchSignalInput {
  return {
    sourceId: TRAVELTIMES_SOURCE.id,
    sourceType: TRAVELTIMES_SOURCE.sourceType,
    signalType: "general_travel_news",
    title: "Autumn travel update",
    summary: "Seasonal travel notes for the coming weeks.",
    claim: "Seasonal travel notes for the coming weeks.",
    claimSource: "source",
    evidence: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        sourceId: TRAVELTIMES_SOURCE.id,
        url: "https://www.traveltimes.co.kr/news/1",
        observedAt: ISO,
        evidenceType: "direct_source",
      },
    ],
    canonicalUrl: "https://www.traveltimes.co.kr/news/1",
    externalId: "tt-1",
    observedAt: ISO,
    geography: [],
    destinations: [],
    topics: ["travel"],
    entities: [],
    metadata: null,
    ...overrides,
  };
}

function normalizeOk(raw: RawResearchSignalInput, definition: ResearchSourceDefinition): ResearchSignal {
  const result = normalizeResearchSignal(raw, sourceRow(definition), NOW);
  if (!result.ok) throw new Error(result.reason);
  return result.signal;
}

const KR = TRAVELTIMES_SOURCE;
const KR_AS_JA = withLanguages(TRAVELTIMES_SOURCE, { primary: "ja" });

describe("languages terminal fallback — helper", () => {
  it("reads only languages.primary from a definition or row; missing/malformed is null", () => {
    expect(resolveSourcePrimaryLanguage(KR)).toBe("ko");
    expect(resolveSourcePrimaryLanguage(sourceRow(NYT_TRAVEL_SOURCE))).toBe("en");
    expect(resolveSourcePrimaryLanguage(withoutSemantics(sourceRow(KR)))).toBeNull();
    expect(resolveSourcePrimaryLanguage(null)).toBeNull();
    expect(resolveSourcePrimaryLanguage({ metadata: { semantics: { languages: { primary: 7 } } } })).toBeNull();
    expect(resolveSourcePrimaryLanguage({ metadata: { semantics: { languages: {} } } })).toBeNull();
  });

  it("the legacy language of every registry definition is its languages.primary", () => {
    for (const source of RESEARCH_SOURCE_REGISTRY) {
      expect(deriveLegacySourceLanguage(source)).toBe(source.semantics.languages.primary);
      expect(deriveLegacySourceLanguage(withLanguages(source, { primary: "ja" }))).toBe("ja");
    }
  });

  it("a supplied language wins; only an unresolved one takes primary; without primary the legacy value stays", () => {
    const kr = sourceRow(KR);
    expect(resolveSignalLanguage("en", kr)).toEqual({ language: "en", languageFallbackApplied: false });
    expect(resolveSignalLanguage(null, kr)).toEqual({ language: "ko", languageFallbackApplied: true });
    expect(resolveSignalLanguage(undefined, kr)).toEqual({ language: "ko", languageFallbackApplied: true });
    expect(resolveSignalLanguage(null, withoutSemantics(kr))).toEqual({
      language: UNRESOLVED_SIGNAL_LANGUAGE,
      languageFallbackApplied: false,
    });
    expect(UNRESOLVED_SIGNAL_LANGUAGE).toBe("en");
  });
});

describe("languages terminal fallback — unresolved items", () => {
  it("9. Korean press items without a collector language were `en` before and follow primary `ko` now", async () => {
    const before = await collectSignals(KR, { mode: "languageless", legacyRow: true });
    const after = await collectSignals(KR, { mode: "languageless" });
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((r) => r.item.language === null && r.mapped.language === null)).toBe(true);
    for (const [i, row] of after.entries()) {
      expect(before[i]!.signal.language).toBe("en");
      expect(before[i]!.signal.metadata).not.toHaveProperty("languageFallbackApplied");
      expect(row.signal.language).toBe("ko");
      expect(row.signal.metadata).toMatchObject({ languageFallbackApplied: true });
      expect(viewWithoutLanguage(row)).toEqual(viewWithoutLanguage(before[i]));
    }
  });

  it("NYT items stripped of language resolve to its primary `en`, flagged as a fallback", async () => {
    const rows = await collectSignals(NYT_TRAVEL_SOURCE, { mode: "stripped" });
    const legacy = await collectSignals(NYT_TRAVEL_SOURCE, { mode: "stripped", legacyRow: true });
    expect(rows.every((r) => r.signal.language === "en" && r.signal.metadata?.languageFallbackApplied === true)).toBe(true);
    expect(rows.map(viewWithoutLanguage)).toEqual(legacy.map(viewWithoutLanguage));
  });

  it("10. mutating primary to `ja` moves unresolved items via the fallback and all registry items via the fallback", async () => {
    const unresolved = await collectSignals(KR_AS_JA, { mode: "languageless" });
    const unresolvedKo = await collectSignals(KR, { mode: "languageless" });
    expect(unresolved.every((r) => r.signal.language === "ja" && r.signal.metadata?.languageFallbackApplied === true)).toBe(true);
    expect(unresolved.map(viewWithoutLanguage)).toEqual(unresolvedKo.map(viewWithoutLanguage));

    const provided = await collectSignals(KR_AS_JA);
    const providedKo = await collectSignals(KR);
    expect(provided.every((r) => r.item.language === null && r.signal.language === "ja")).toBe(true);
    expect(provided.every((r) => r.signal.metadata?.languageFallbackApplied === true)).toBe(true);
    expect(provided.map(viewWithoutLanguage)).toEqual(providedKo.map(viewWithoutLanguage));
  });
});

describe("languages terminal fallback — supplied values are protected", () => {
  it("11. explicit item language `en` stays `en` under primary ko / ja / vi", () => {
    const signals = (["ko", "ja", "vi"] as const).map((primary) =>
      normalizeOk(rawSignal({ language: "en" }), withLanguages(KR, { primary })),
    );
    for (const signal of signals) {
      expect(signal.language).toBe("en");
      expect(signal.metadata ?? {}).not.toHaveProperty("languageFallbackApplied");
    }
    expect(signals.map(stable)).toEqual([stable(signals[0]), stable(signals[0]), stable(signals[0])]);
  });

  it("12. collector-provided `vi` stays `vi` on an `en`-primary source (no language inference exists to protect)", async () => {
    const collector = createResearchCollectorForSource(VIETNAM_TRAVEL_SOURCE, {
      fetchImpl: mockFeedFetch({ [VIETNAM_TRAVEL_SOURCE.feedUrl]: VN_LANGUAGE_FEED }),
    });
    const items = await collector.collect({ sourceId: VIETNAM_TRAVEL_SOURCE.id, sourceType: VIETNAM_TRAVEL_SOURCE.sourceType, now: NOW });
    for (const item of items) {
      const mapped = mapRawResearchItemToSignalInput({ ...item, language: "vi" }, {
        sourceId: VIETNAM_TRAVEL_SOURCE.id,
        sourceType: VIETNAM_TRAVEL_SOURCE.sourceType,
      })!;
      expect(normalizeOk(mapped, VIETNAM_TRAVEL_SOURCE).language).toBe("vi");
      expect(normalizeOk(mapped, withLanguages(VIETNAM_TRAVEL_SOURCE, { primary: "ko" })).language).toBe("vi");
    }
  });

  it("13. locale is never created or overwritten by primary", async () => {
    for (const mode of ["registry", "languageless"] as const) {
      for (const definition of [KR, KR_AS_JA]) {
        const rows = await collectSignals(definition, { mode });
        expect(rows.every((r) => r.item.locale === "ko-KR")).toBe(true);
        expect(rows.every((r) => !("locale" in r.signal) && !("locale" in r.mapped))).toBe(true);
      }
    }
    for (const primary of ["ko", "ja"]) {
      const kept = normalizeOk(rawSignal({ language: null, locale: "en-US" }), withLanguages(KR, { primary }));
      expect((kept as ResearchSignal & { locale?: string }).locale).toBe("en-US");
      expect(kept.language).toBe(primary);
      const none = normalizeOk(rawSignal({ language: null }), withLanguages(KR, { primary }));
      expect(none).not.toHaveProperty("locale");
    }
    for (const source of EXTERNAL_RESEARCH_SOURCE_REGISTRY) {
      const row = projectResearchSource(withLanguages(source, { primary: "vi" }));
      expect([row.language, row.locale]).toEqual(["vi", source.locale]);
    }
  });
});

describe("languages terminal fallback — parity", () => {
  it("14. every registry feed leaves language unresolved, so the terminal fallback fires; a primary mutation moves only language", async () => {
    for (const source of EXTERNAL_RESEARCH_SOURCE_REGISTRY) {
      const current = await collectSignals(source);
      expect(current.length).toBeGreaterThan(0);
      expect(current.map(viewWithoutLanguage)).toEqual((await collectSignals(source, { legacyRow: true })).map(viewWithoutLanguage));
      expect(
        current.every((r) => r.signal.language === source.semantics.languages.primary && r.signal.metadata?.languageFallbackApplied === true),
      ).toBe(true);
      const relabeled = await collectSignals(withLanguages(source, { primary: "ja" }));
      expect(relabeled.every((r) => r.signal.language === "ja" && r.signal.metadata?.languageFallbackApplied === true)).toBe(true);
      expect(relabeled.map(viewWithoutLanguage)).toEqual(current.map(viewWithoutLanguage));
    }
  });

  it("15. Performance keeps its explicit `ko`; Meta bypasses normalization and keeps `ko`", async () => {
    const perfRepo = createInMemoryContentPerformanceRepository();
    await perfRepo.save({
      snapshot: {
        collectionId: "pcol_language",
        logicalObservationKey: "language-obs",
        candidateId: "cmc_language",
        humanReviewId: "hmr_language",
        platform: "threads",
        channel: "threads",
        externalPostId: "language_post",
        publishedAt: "2026-09-30T10:00:00.000Z",
        publicationSource: "manual",
        contentOrigin: "human_edited",
        collectionStatus: "success",
        observedAt: "2026-10-01T01:00:00.000Z",
        dataAvailability: "available",
        topic: "가을 여행 성과",
        destinations: ["japan"],
        format: "thread",
        commercialIntent: "awareness",
        productLinked: false,
        sampleQuality: "single_post_sample",
      },
      metrics: [{ metricType: "impressions", metricValue: 900 }],
    });
    const repo = createInMemoryResearchRepository();
    const load = await loadPerformanceFeedbackSignals({ repo, performanceRepo: perfRepo, since: "2026-09-01T00:00:00.000Z", now: NOW });
    expect(load.signals.map((s) => s.language)).toEqual(["ko"]);
    const perf = (await runResearchPipeline({ repo, rawSignals: load.signals, now: NOW })).normalized;
    expect(perf.length).toBeGreaterThan(0);
    expect(perf.every((s) => s.language === "ko" && s.signalType === "content_performance" && !s.metadata?.languageFallbackApplied)).toBe(true);
    const perfRaw = load.signals[0]!;
    expect(stable(normalizeOk(perfRaw, withLanguages(PERFORMANCE_MEMORY_SOURCE_DEFINITION, { primary: "ja" })))).toEqual(
      stable(normalizeOk(perfRaw, PERFORMANCE_MEMORY_SOURCE_DEFINITION)),
    );
    const metaDefault = adaptTrendSignalToResearch(FIXTURE_BUSAN_FAMILY_CRUISE, NOW);
    const metaRelabeled = adaptTrendSignalToResearch(
      FIXTURE_BUSAN_FAMILY_CRUISE,
      NOW,
      withLanguages(META_AI_TREND_SOURCE_DEFINITION, { primary: "ja" }),
    );
    expect(metaDefault.signal.language).toBe("ko");
    expect(stable(metaRelabeled.signal)).toEqual(stable(metaDefault.signal));
    expect(stable(metaRelabeled.agendaCandidate)).toEqual(stable(metaDefault.agendaCandidate));
  });

  it("16. coverage and language fallbacks are independent and each flags only its own field", async () => {
    const fixture = { [VIETNAM_TRAVEL_SOURCE.feedUrl]: VN_LANGUAGE_FEED };
    const vi = withLanguages(VIETNAM_TRAVEL_SOURCE, { primary: "vi" });
    const rows = new Map((await collectSignals(vi, { mode: "languageless", fixture })).map((r) => [r.title, r.signal]));
    for (const title of ["Lantern evenings by the river", "Celebrating the lunar new year"]) {
      expect([rows.get(title)?.geography, rows.get(title)?.language]).toEqual([["vn"], "vi"]);
      expect(rows.get(title)?.metadata).toMatchObject({ geographyFallbackApplied: true, languageFallbackApplied: true });
    }
    const hanoi = rows.get("Hanoi street food night walk")!;
    expect([hanoi.geography, hanoi.language]).toEqual([[], "vi"]);
    expect(hanoi.metadata).not.toHaveProperty("geographyFallbackApplied");
    expect(hanoi.metadata).toMatchObject({ languageFallbackApplied: true });

    const geographyOf = (signals: CollectedSignal[]) => signals.map((r) => [r.title, r.signal.geography, r.signal.metadata?.geographyFallbackApplied]);
    const languageOf = (signals: CollectedSignal[]) => signals.map((r) => [r.title, r.signal.language, r.signal.metadata?.languageFallbackApplied]);
    const base = await collectSignals(VIETNAM_TRAVEL_SOURCE, { mode: "languageless", fixture });
    const relabeled = await collectSignals(vi, { mode: "languageless", fixture });
    const rescoped = structuredClone(VIETNAM_TRAVEL_SOURCE);
    rescoped.semantics.coverage = { scope: "global" };
    const globalRows = await collectSignals(rescoped, { mode: "languageless", fixture });
    expect(geographyOf(relabeled)).toEqual(geographyOf(base));
    expect(languageOf(globalRows)).toEqual(languageOf(base));
    expect(globalRows.every((r) => r.signal.geography.length === 0 && !r.signal.metadata?.geographyFallbackApplied)).toBe(true);

    const provided = await collectSignals(VIETNAM_TRAVEL_SOURCE, { fixture });
    expect(provided.every((r) => r.signal.metadata?.languageFallbackApplied === true)).toBe(true);
    expect(provided.filter((r) => r.signal.metadata?.geographyFallbackApplied).length).toBe(2);
  });

  it("18. raw and normalized fingerprints do not take language as input", async () => {
    const legacy = await collectSignals(KR, { mode: "languageless", legacyRow: true });
    for (const definition of [KR, KR_AS_JA]) {
      const rows = await collectSignals(definition, { mode: "languageless" });
      expect(rows.map((r) => r.signal.language)).not.toEqual(legacy.map((r) => r.signal.language));
      expect(rows.map((r) => r.signal.rawFingerprint)).toEqual(legacy.map((r) => r.signal.rawFingerprint));
      expect(rows.map((r) => r.signal.normalizedFingerprint)).toEqual(legacy.map((r) => r.signal.normalizedFingerprint));
    }
  });
});

describe("languages terminal fallback — downstream", () => {
  async function scenario(korean: ExternalResearchSourceDefinition) {
    const definitions = EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((s) => (s.id === korean.id ? korean : s));
    const repo = createInMemoryResearchRepository();
    for (const source of definitions) await repo.upsertSource(sourceRow(source));
    const rawSignals: RawResearchSignalInput[] = [];
    for (const source of definitions) {
      const mode = source.id === korean.id ? "languageless" : "registry";
      rawSignals.push(...(await collectSignals(source, { mode })).map((r) => r.mapped));
    }
    const pipeline = await runResearchPipeline({ repo, rawSignals, now: NOW });
    const mm = await getMarketingManagerResearchContext(
      { lookbackHours: 168, limit: 30 },
      { repo, now: NOW, checkSemanticInfrastructure: async () => false },
    );
    return { pipeline, mm };
  }

  it("19. fallback languages reach persisted signals only: scores, families, candidates and MM context are unchanged", async () => {
    const ko = await scenario(KR);
    const ja = await scenario(KR_AS_JA);
    const koreanSignals = (r: typeof ko) => r.pipeline.normalized.filter((s) => s.sourceId === KR.id);
    expect(koreanSignals(ko).length).toBeGreaterThan(0);
    expect(koreanSignals(ko).every((s) => s.language === "ko")).toBe(true);
    expect(koreanSignals(ja).every((s) => s.language === "ja")).toBe(true);
    expect(ko.pipeline.normalized.filter((s) => s.sourceId !== KR.id).every((s) => s.metadata?.languageFallbackApplied === true)).toBe(true);

    const candidateView = (r: typeof ko) =>
      r.pipeline.agendaCandidates
        .map((c) => JSON.stringify(stable({ ...c, family: destinationTopicFamilyKey(c) })))
        .sort();
    expect(ko.pipeline.agendaCandidates.length).toBeGreaterThan(0);
    expect(candidateView(ja)).toEqual(candidateView(ko));
    expect(stable(ja.mm)).toEqual(stable(ko.mm));
  });
});
