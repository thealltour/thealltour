import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { bootstrapResearchSources } from "@/lib/marketing/research/collection/bootstrapSources";
import { runResearchCollectionCycle } from "@/lib/marketing/research/collection/runResearchCollectionCycle";
import {
  PARITY_FIXTURE_BY_FEED as FIXTURE_BY_FEED,
  mockFeedFetch as mockFetch,
  withoutRemovedDeadMetadata,
  withoutSemantics,
} from "@/lib/marketing/research/__tests__/sourceRegistryParityFixtures";
import * as collectorsBarrel from "@/lib/marketing/research/collectors";
import {
  EXTERNAL_RESEARCH_SOURCE_REGISTRY,
  MVP_RESEARCH_SOURCES,
  NYT_TRAVEL_SOURCE,
  TRAVELDAILY_SOURCE,
  TRAVELTIMES_SOURCE,
  TRAVIE_SOURCE,
  UK_GOV_TRAVEL_SOURCE,
  VIETNAM_TRAVEL_SOURCE,
  createDefaultResearchCollectors,
  createNytTravelRssCollector,
  createUkGovTravelAdviceCollector,
  mapRawResearchItemToSignalInput,
  toConfiguredRssCollectorConfig,
  type RawResearchItem,
  type ResearchCollector,
} from "@/lib/marketing/research/collectors";
import { mapNytItemToRawResearchItem } from "@/lib/marketing/research/collectors/nytTravelRssCollector";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import { normalizeResearchSignal } from "@/lib/marketing/research/services/normalizer";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

const NOW = new Date("2026-10-01T09:00:00.000Z");

/** Pre-registry values of the six external sources (copied from the hand-written config). */
const LEGACY_SOURCES = [
  {
    id: "a3011111-1111-4111-8111-111111111101",
    sourceType: "official_government",
    name: "UK FCDO Foreign Travel Advice",
    canonicalUrl: "https://www.gov.uk/foreign-travel-advice.atom",
    provider: "gov.uk",
    authorityLevel: "official",
    defaultCredibility: 0.88,
    locale: "en-GB",
    country: "GB",
    language: "en",
    isOfficial: true,
    isEnabled: true,
    metadata: {
      feedKind: "atom",
      collectorId: "uk-gov-travel-advice",
      portfolio: { role: "safety_verification", agendaSeedWeight: 0.18, evidenceAuthorityWeight: 0.96, koreanMarketWeight: 0.22 },
    },
  },
  {
    id: "a3022222-2222-4222-8222-222222222222",
    sourceType: "news",
    name: "NYT Travel RSS",
    canonicalUrl: "https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml",
    provider: "nytimes.com",
    authorityLevel: "secondary",
    defaultCredibility: 0.62,
    locale: "en-US",
    country: "US",
    language: "en",
    isOfficial: false,
    isEnabled: true,
    metadata: {
      feedKind: "rss",
      collectorId: "nyt-travel-rss",
      portfolio: { role: "global_travel_editorial", agendaSeedWeight: 0.52, evidenceAuthorityWeight: 0.58, koreanMarketWeight: 0.38 },
    },
  },
  {
    id: "a3033333-3333-4333-8333-333333333333",
    sourceType: "travel_industry",
    name: "여행신문 Traveltimes",
    canonicalUrl: "https://www.traveltimes.co.kr/rss/allArticle.xml",
    provider: "traveltimes.co.kr",
    authorityLevel: "secondary",
    defaultCredibility: 0.58,
    locale: "ko-KR",
    country: "KR",
    language: "ko",
    isOfficial: false,
    isEnabled: true,
    metadata: {
      feedKind: "rss",
      collectorId: "traveltimes-rss",
      portfolio: { role: "korean_travel_editorial", agendaSeedWeight: 0.9, evidenceAuthorityWeight: 0.52, koreanMarketWeight: 0.95 },
    },
  },
  {
    id: "a3044444-4444-4444-8444-444444444444",
    sourceType: "travel_industry",
    name: "트래비 Travie",
    canonicalUrl: "https://www.travie.com/rss/allArticle.xml",
    provider: "travie.com",
    authorityLevel: "secondary",
    defaultCredibility: 0.56,
    locale: "ko-KR",
    country: "KR",
    language: "ko",
    isOfficial: false,
    isEnabled: true,
    metadata: {
      feedKind: "rss",
      collectorId: "travie-rss",
      portfolio: { role: "korean_travel_editorial", agendaSeedWeight: 0.88, evidenceAuthorityWeight: 0.5, koreanMarketWeight: 0.93 },
    },
  },
  {
    id: "a3055555-5555-4555-8555-555555555555",
    sourceType: "travel_industry",
    name: "트래블데일리 TravelDaily",
    canonicalUrl: "https://www.traveldaily.co.kr/rss/allArticle.xml",
    provider: "traveldaily.co.kr",
    authorityLevel: "secondary",
    defaultCredibility: 0.55,
    locale: "ko-KR",
    country: "KR",
    language: "ko",
    isOfficial: false,
    isEnabled: true,
    metadata: {
      feedKind: "rss",
      collectorId: "traveldaily-rss",
      portfolio: { role: "korean_travel_editorial", agendaSeedWeight: 0.86, evidenceAuthorityWeight: 0.5, koreanMarketWeight: 0.92 },
    },
  },
  {
    id: "a3066666-6666-4666-8666-666666666666",
    sourceType: "tourism_board",
    name: "Vietnam National Tourism RSS",
    canonicalUrl: "https://vietnam.travel/rss.xml",
    provider: "vietnam.travel",
    authorityLevel: "official",
    defaultCredibility: 0.8,
    locale: "en",
    country: "VN",
    language: "en",
    isOfficial: true,
    isEnabled: true,
    metadata: {
      feedKind: "rss",
      collectorId: "vietnam-travel-rss",
      destinationFocus: "vietnam",
      portfolio: { role: "destination_official", agendaSeedWeight: 0.78, evidenceAuthorityWeight: 0.9, koreanMarketWeight: 0.82 },
    },
  },
] as const;

const LEGACY_COLLECTOR_SOURCE_ID: Record<string, string> = {
  "uk-gov-travel-advice": "a3011111-1111-4111-8111-111111111101",
  "nyt-travel-rss": "a3022222-2222-4222-8222-222222222222",
  "traveltimes-rss": "a3033333-3333-4333-8333-333333333333",
  "travie-rss": "a3044444-4444-4444-8444-444444444444",
  "traveldaily-rss": "a3055555-5555-4555-8555-555555555555",
  "vietnam-travel-rss": "a3066666-6666-4666-8666-666666666666",
};

/** Raw fingerprints produced by the pre-registry collectors for the parity fixtures. */
const LEGACY_FIXTURE_FINGERPRINTS: Record<string, Array<{ title: string; signalType: string; rawFingerprint: string }>> = {
  "uk-gov-travel-advice": [
    { title: "Japan", signalType: "entry_requirement", rawFingerprint: "b8562b8bd6133ebae46af3cfe9d832d7ea87f72cfffff3387c203a0046ef3a2f" },
    { title: "Thailand", signalType: "safety", rawFingerprint: "861c2a8a1a81646ca834df2e0100f822e3f030038d7b802c134b99aa56c01f68" },
    { title: "Italy", signalType: "entry_requirement", rawFingerprint: "c94d4558edf418d870f7f1f5daac356c97eba3c6ce6e14f57860095f6eae9db5" },
  ],
  "nyt-travel-rss": [
    { title: "How to Plan a Trip to Spain", signalType: "hotel_resort", rawFingerprint: "8c2e0f8da07dd65b7c41b030f7aafef64a8a64ad0c28eb327fb8b2a3d3b76f9c" },
    { title: "A Long Weekend in Lisbon", signalType: "general_travel_news", rawFingerprint: "89bc4ba16b6d70f86afebb433e16f1df6996913ca4bfdac2982e73dcd6d466f2" },
  ],
  "traveltimes-rss": [
    { title: "추석 앞두고 도쿄권 태풍 변수…275편 결항 뒤 상황은", signalType: "general_travel_news", rawFingerprint: "af81a7feed39ef076cc9994fd92e2762e552f0d028ad6b6cf5a244cf86bbcf9e" },
    { title: "가을엔 3대가 함께 코타키나발루로", signalType: "general_travel_news", rawFingerprint: "30b698dd12ed0c5a35e5e22744fad5d42257a1f6ea5da113e84e63b0e0b5f4bd" },
  ],
  "travie-rss": [
    { title: "추석 앞두고 도쿄권 태풍 변수…275편 결항 뒤 상황은", signalType: "general_travel_news", rawFingerprint: "72c17b33cdd59bf1692e8568988d306095dc5066af924f079fc449337ee3f4c5" },
    { title: "가을엔 3대가 함께 코타키나발루로", signalType: "general_travel_news", rawFingerprint: "a01abc50fb3f6f859c37b5045e2dfb2965c16eb555f7fbf726eedbf912213808" },
  ],
  "traveldaily-rss": [
    { title: "추석 앞두고 도쿄권 태풍 변수…275편 결항 뒤 상황은", signalType: "general_travel_news", rawFingerprint: "47c272c69d6abd2a1d9b0252755d8f271c4034fe49e4c14d098f4664b9836d74" },
    { title: "가을엔 3대가 함께 코타키나발루로", signalType: "general_travel_news", rawFingerprint: "ad2bc9b1d9679680aa054e675948d3f0076af4219f0e2a97c1685f31db0d5621" },
  ],
  "vietnam-travel-rss": [
    { title: "A celestial journey through Vietnam", signalType: "destination_trend", rawFingerprint: "a41c85982f819fdcabc6746558e9063d3fd3ca9833c567292cb6791efa22f86f" },
    { title: "Vietnam extends e-visa validity", signalType: "entry_requirement", rawFingerprint: "741cfb5263b888eac007812a8b24615ead967fe5e8a60b6d6328b5ceef039a55" },
    { title: "New flight connects Da Nang and Busan", signalType: "flight_route", rawFingerprint: "1d42022317d04a27882528d210db3755ea28c1e521ca99d0cfd8509b3bc489a7" },
  ],
};

function sourceRecord(sourceId: string): ResearchSource {
  const source = MVP_RESEARCH_SOURCES.find((s) => s.id === sourceId);
  if (!source) throw new Error(`missing source ${sourceId}`);
  return { ...source, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() };
}

async function collectWithFingerprints(collector: ResearchCollector) {
  const sourceId = LEGACY_COLLECTOR_SOURCE_ID[collector.collectorId]!;
  const items = await collector.collect({ sourceId, sourceType: collector.sourceType, now: NOW, maxItems: 25 });
  return items.map((item) => {
    const mapped = mapRawResearchItemToSignalInput(item, { sourceId, sourceType: collector.sourceType });
    const normalized = mapped ? normalizeResearchSignal(mapped, sourceRecord(sourceId), NOW) : null;
    return {
      item,
      signalType: mapped?.signalType ?? null,
      rawFingerprint: normalized?.ok ? normalized.signal.rawFingerprint : null,
    };
  });
}

function withoutEvidenceIds(items: RawResearchItem[]) {
  return items.map((item) => ({ ...item, evidence: item.evidence.map((e) => ({ ...e, id: "<id>" })) }));
}

function collectorById(id: string, fetchImpl: typeof fetch): ResearchCollector {
  const collector = createDefaultResearchCollectors({ fetchImpl }).find((c) => c.collectorId === id);
  if (!collector) throw new Error(`missing collector ${id}`);
  return collector;
}

describe("external source registry — source projection parity", () => {
  it("lists the six external sources in the legacy order with unique id/key/feed", () => {
    expect(EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((s) => s.key)).toEqual(Object.keys(LEGACY_COLLECTOR_SOURCE_ID));
    for (const field of ["id", "key", "feedUrl"] as const) {
      const values = EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((s) => s[field]);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("projects MVP_RESEARCH_SOURCES identical to the legacy literal list apart from metadata.semantics and the dropped dead metadata", () => {
    const legacyLive = LEGACY_SOURCES.map(withoutRemovedDeadMetadata);
    expect(MVP_RESEARCH_SOURCES.map(withoutSemantics)).toStrictEqual(legacyLive);
    expect(JSON.stringify(MVP_RESEARCH_SOURCES.map(withoutSemantics))).toBe(JSON.stringify(legacyLive));
  });

  it("drops only destinationFocus and portfolio.evidenceAuthorityWeight from the legacy metadata shape", () => {
    expect(LEGACY_SOURCES.some((s) => "destinationFocus" in s.metadata)).toBe(true);
    expect(LEGACY_SOURCES.every((s) => "evidenceAuthorityWeight" in s.metadata.portfolio)).toBe(true);
    for (const row of MVP_RESEARCH_SOURCES) {
      const metadata = row.metadata as Record<string, Record<string, unknown>>;
      expect(metadata).not.toHaveProperty("destinationFocus");
      expect(metadata.portfolio).not.toHaveProperty("evidenceAuthorityWeight");
      expect(Object.keys(metadata.portfolio!)).toEqual(["role", "agendaSeedWeight", "koreanMarketWeight"]);
      expect(metadata).toHaveProperty("semantics");
    }
  });

  it("uses registry .id as the only source id surface; UUIDs are unchanged", () => {
    expect([
      UK_GOV_TRAVEL_SOURCE.id,
      NYT_TRAVEL_SOURCE.id,
      TRAVELTIMES_SOURCE.id,
      TRAVIE_SOURCE.id,
      TRAVELDAILY_SOURCE.id,
      VIETNAM_TRAVEL_SOURCE.id,
    ]).toEqual(LEGACY_SOURCES.map((s) => s.id));
    expect(EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((s) => s.id)).toEqual(LEGACY_SOURCES.map((s) => s.id));
    expect(EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((s) => s.feedUrl)).toEqual(LEGACY_SOURCES.map((s) => s.canonicalUrl));
    expect(Object.keys(collectorsBarrel).filter((name) => name.endsWith("_SOURCE_ID"))).toEqual([]);
  });

  it("bootstraps the same source rows into the repository apart from the dropped dead metadata", async () => {
    const repo = createInMemoryResearchRepository();
    await bootstrapResearchSources(repo, NOW);
    for (const legacy of LEGACY_SOURCES) {
      const stored = await repo.getSourceById(legacy.id);
      expect(withoutSemantics(stored)).toEqual({
        ...withoutRemovedDeadMetadata(legacy),
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      });
    }
  });
});

describe("external source registry — collector wiring parity", () => {
  it("creates collectors in legacy order with legacy source types", () => {
    expect(createDefaultResearchCollectors().map((c) => [c.collectorId, c.sourceType])).toEqual([
      ["uk-gov-travel-advice", "official_government"],
      ["nyt-travel-rss", "news"],
      ["traveltimes-rss", "travel_industry"],
      ["travie-rss", "travel_industry"],
      ["traveldaily-rss", "travel_industry"],
      ["vietnam-travel-rss", "tourism_board"],
    ]);
  });

  it("gives every collector the legacy sourceId for its collectorId", () => {
    expect(Object.fromEntries(createDefaultResearchCollectors().map((c) => [c.collectorId, c.sourceId]))).toEqual(
      LEGACY_COLLECTOR_SOURCE_ID,
    );
  });

  it("assigns mapper profiles without folding FCDO/NYT into generic", () => {
    expect(Object.fromEntries(EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((s) => [s.key, s.collector.mapperProfile]))).toEqual({
      "uk-gov-travel-advice": "uk_gov_travel_advice",
      "nyt-travel-rss": "nyt_travel",
      "traveltimes-rss": "generic",
      "travie-rss": "generic",
      "traveldaily-rss": "generic",
      "vietnam-travel-rss": "generic",
    });
  });

  it("builds generic collector configs identical to the legacy inline configs plus the semantics fallback", () => {
    const generic = EXTERNAL_RESEARCH_SOURCE_REGISTRY.filter((s) => s.collector.mapperProfile === "generic");
    expect(generic.map(toConfiguredRssCollectorConfig)).toStrictEqual([
      { collectorId: "traveltimes-rss", isOfficial: false, sourceId: TRAVELTIMES_SOURCE.id, feedUrl: "https://www.traveltimes.co.kr/rss/allArticle.xml", sourceType: "travel_industry", locale: "ko-KR", language: "ko", defaultSignalType: "general_travel_news" },
      { collectorId: "travie-rss", isOfficial: false, sourceId: TRAVIE_SOURCE.id, feedUrl: "https://www.travie.com/rss/allArticle.xml", sourceType: "travel_industry", locale: "ko-KR", language: "ko", defaultSignalType: "general_travel_news" },
      { collectorId: "traveldaily-rss", isOfficial: false, sourceId: TRAVELDAILY_SOURCE.id, feedUrl: "https://www.traveldaily.co.kr/rss/allArticle.xml", sourceType: "travel_industry", locale: "ko-KR", language: "ko", defaultSignalType: "general_travel_news" },
      {
        collectorId: "vietnam-travel-rss",
        isOfficial: true,
        sourceId: VIETNAM_TRAVEL_SOURCE.id,
        feedUrl: "https://vietnam.travel/rss.xml",
        sourceType: "tourism_board",
        locale: "en",
        language: "en",
        destinationHints: ["vietnam"],
        evidenceType: "official_statement",
        defaultSignalType: "destination_trend",
      },
    ]);
  });

  it("each collector fetches exactly its registry feed URL", async () => {
    for (const source of EXTERNAL_RESEARCH_SOURCE_REGISTRY) {
      const requested: string[] = [];
      const collector = collectorById(source.key, mockFetch(FIXTURE_BY_FEED, requested));
      await collector.collect({ sourceId: source.id, sourceType: collector.sourceType, now: NOW });
      expect(requested).toEqual([source.feedUrl]);
    }
  });

  it("keeps locale/collectorId but no longer stamps source language", async () => {
    for (const source of EXTERNAL_RESEARCH_SOURCE_REGISTRY) {
      const rows = await collectWithFingerprints(collectorById(source.key, mockFetch(FIXTURE_BY_FEED)));
      expect(rows.length).toBeGreaterThan(0);
      for (const { item } of rows) {
        expect(item.locale).toBe(source.locale);
        expect(item.language).toBeNull();
        expect(item.metadata?.collectorId).toBe(source.key);
        expect(item.evidence[0]?.sourceId).toBe(source.id);
      }
    }
  });
});

describe("external source registry — mapper and fingerprint parity", () => {
  it.each(Object.keys(LEGACY_FIXTURE_FINGERPRINTS))("%s keeps legacy titles, signal types and raw fingerprints", async (collectorId) => {
    const rows = await collectWithFingerprints(collectorById(collectorId, mockFetch(FIXTURE_BY_FEED)));
    expect(rows.map((r) => ({ title: r.item.title, signalType: r.signalType, rawFingerprint: r.rawFingerprint }))).toEqual(
      LEGACY_FIXTURE_FINGERPRINTS[collectorId],
    );
  });

  it("FCDO profile keeps full summaries (no 240-char claim cut) and short items", async () => {
    const rows = await collectWithFingerprints(collectorById("uk-gov-travel-advice", mockFetch(FIXTURE_BY_FEED)));
    const thailand = rows.find((r) => r.item.title === "Thailand")!.item;
    expect(thailand.summary?.length).toBeGreaterThan(240);
    expect(thailand.summary?.endsWith("...")).toBe(false);
    expect(thailand.evidence[0]?.excerpt).toBe(thailand.summary);
    expect(thailand.evidence[0]?.evidenceType).toBe("official_statement");
    expect(thailand.metadata).toEqual({
      collectorId: "uk-gov-travel-advice",
      signalTypeHint: "safety",
      feedUrl: "https://www.gov.uk/foreign-travel-advice.atom",
    });
    expect(rows.some((r) => r.item.title === "Italy")).toBe(true);
  });

  it("NYT profile keeps the 12-char floor, direct_source evidence and claimSource metadata", async () => {
    const rows = await collectWithFingerprints(collectorById("nyt-travel-rss", mockFetch(FIXTURE_BY_FEED)));
    expect(rows.some((r) => r.item.title === "Short")).toBe(false);
    for (const { item } of rows) {
      expect(item.evidence[0]?.evidenceType).toBe("direct_source");
      expect(item.metadata).toMatchObject({
        claimSource: "source",
        feedUrl: "https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml",
      });
    }
  });

  it("legacy factory signatures produce identical items to registry-driven collectors", async () => {
    const legacyUk = await createUkGovTravelAdviceCollector({ fetchImpl: mockFetch(FIXTURE_BY_FEED) }).collect({
      sourceId: UK_GOV_TRAVEL_SOURCE.id,
      sourceType: "official_government",
      now: NOW,
    });
    const registryUk = await createUkGovTravelAdviceCollector({ fetchImpl: mockFetch(FIXTURE_BY_FEED) }, UK_GOV_TRAVEL_SOURCE).collect({
      sourceId: UK_GOV_TRAVEL_SOURCE.id,
      sourceType: "official_government",
      now: NOW,
    });
    expect(withoutEvidenceIds(registryUk)).toEqual(withoutEvidenceIds(legacyUk));

    const legacyNyt = await createNytTravelRssCollector({ fetchImpl: mockFetch(FIXTURE_BY_FEED) }).collect({
      sourceId: NYT_TRAVEL_SOURCE.id,
      sourceType: "news",
      now: NOW,
    });
    const registryNyt = await createNytTravelRssCollector({ fetchImpl: mockFetch(FIXTURE_BY_FEED) }, NYT_TRAVEL_SOURCE).collect({
      sourceId: NYT_TRAVEL_SOURCE.id,
      sourceType: "news",
      now: NOW,
    });
    expect(withoutEvidenceIds(registryNyt)).toEqual(withoutEvidenceIds(legacyNyt));

    const feedItem = {
      title: "How to Plan a Trip to Spain",
      link: "https://www.nytimes.com/2026/09/29/travel/spain-trip.html",
      summary: "Practical tips for booking flights and hotels in Spain this season.",
      publishedAt: "2026-09-29T10:00:00.000Z",
      externalId: "https://www.nytimes.com/2026/09/29/travel/spain-trip.html",
    };
    const context = { sourceId: NYT_TRAVEL_SOURCE.id, observedAt: NOW.toISOString() };
    const twoArg = mapNytItemToRawResearchItem(feedItem, context);
    const threeArg = mapNytItemToRawResearchItem(feedItem, context, NYT_TRAVEL_SOURCE);
    expect(threeArg && withoutEvidenceIds([threeArg])).toEqual(twoArg && withoutEvidenceIds([twoArg]));
  });

  it("Vietnam (tourism_board) keeps the B1 destination_trend fallback and destination hint", async () => {
    const rows = await collectWithFingerprints(collectorById("vietnam-travel-rss", mockFetch(FIXTURE_BY_FEED)));
    const celestial = rows.find((r) => r.item.title === "A celestial journey through Vietnam")!;
    expect(celestial.signalType).toBe("destination_trend");
    expect(celestial.item.metadata).toMatchObject({ signalTypeHint: "destination_trend", signalTypeFallbackApplied: true });
    for (const { item } of rows) {
      expect(item.destinationHints).toContain("vietnam");
      expect(item.evidence[0]?.evidenceType).toBe("official_statement");
    }
  });
});

describe("external source registry — collection cycle", () => {
  it("runs every registry collector with its registry source id", async () => {
    const repo = createInMemoryResearchRepository();
    const result = await runResearchCollectionCycle({
      repo,
      now: NOW,
      env: { RESEARCH_COLLECTION_ENABLED: "true" },
      collectors: createDefaultResearchCollectors({ fetchImpl: mockFetch(FIXTURE_BY_FEED) }),
    });
    expect(result.collectorResults.map((r) => [r.collectorId, r.sourceId, r.status])).toEqual(
      Object.entries(LEGACY_COLLECTOR_SOURCE_ID).map(([collectorId, sourceId]) => [collectorId, sourceId, "success"]),
    );
    expect(result.collectorResults.map((r) => r.itemsAccepted)).toEqual([3, 2, 2, 2, 2, 3]);
  });

  it("keeps per-collector env toggles with the registry source id on skipped results", async () => {
    const repo = createInMemoryResearchRepository();
    const result = await runResearchCollectionCycle({
      repo,
      now: NOW,
      env: { RESEARCH_COLLECTION_ENABLED: "true", RESEARCH_TRAVIE_RSS_ENABLED: "false" },
      collectors: createDefaultResearchCollectors({ fetchImpl: mockFetch(FIXTURE_BY_FEED) }),
    });
    const travie = result.collectorResults.find((r) => r.collectorId === "travie-rss");
    expect(travie).toMatchObject({ status: "skipped", sourceId: TRAVIE_SOURCE.id, itemsObserved: 0 });
    expect(result.status).toBe("success");
  });
});
