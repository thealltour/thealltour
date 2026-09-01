import { randomUUID } from "node:crypto";

import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type { RawResearchSignalInput } from "@/lib/marketing/research/types/researchSignal";

const NOW = "2026-09-02T00:00:00.000Z";

export const OFFICIAL_JNTO_SOURCE: ResearchSource = {
  id: "11111111-1111-4111-8111-111111111101",
  sourceType: "tourism_board",
  name: "JNTO Official",
  canonicalUrl: "https://www.japan.travel/en/",
  authorityLevel: "official",
  defaultCredibility: 0.85,
  locale: "ja-JP",
  country: "JP",
  language: "en",
  isOfficial: true,
  isEnabled: true,
  metadata: null,
  createdAt: NOW,
  updatedAt: NOW,
};

export const COMMUNITY_SOURCE: ResearchSource = {
  id: "22222222-2222-4222-8222-222222222222",
  sourceType: "community",
  name: "Travel Forum Aggregate",
  authorityLevel: "community",
  defaultCredibility: 0.35,
  language: "ko",
  isOfficial: false,
  isEnabled: true,
  metadata: null,
  createdAt: NOW,
  updatedAt: NOW,
};

export const INTERNAL_PRODUCT_SOURCE: ResearchSource = {
  id: "33333333-3333-4333-8333-333333333333",
  sourceType: "internal_product",
  name: "TheAllTour Product Catalog",
  authorityLevel: "primary",
  defaultCredibility: 0.9,
  language: "ko",
  isOfficial: true,
  isEnabled: true,
  metadata: null,
  createdAt: NOW,
  updatedAt: NOW,
};

export const PERFORMANCE_SOURCE: ResearchSource = {
  id: "44444444-4444-4444-8444-444444444444",
  sourceType: "performance_memory",
  name: "Performance Analyst Memory",
  authorityLevel: "primary",
  defaultCredibility: 0.75,
  language: "ko",
  isOfficial: false,
  isEnabled: true,
  metadata: null,
  createdAt: NOW,
  updatedAt: NOW,
};

export const RESEARCH_TEST_SOURCES = [
  OFFICIAL_JNTO_SOURCE,
  COMMUNITY_SOURCE,
  INTERNAL_PRODUCT_SOURCE,
  PERFORMANCE_SOURCE,
];

function baseSignal(
  overrides: Partial<RawResearchSignalInput> & Pick<RawResearchSignalInput, "sourceId" | "signalType" | "title" | "summary">,
): RawResearchSignalInput {
  return {
    sourceType: OFFICIAL_JNTO_SOURCE.sourceType,
    claim: overrides.summary,
    claimSource: "source",
    evidence: [
      {
        id: randomUUID(),
        sourceId: overrides.sourceId,
        url: "https://example.com/source",
        title: "Source document",
        excerpt: overrides.summary,
        observedAt: NOW,
        evidenceType: "official_statement",
      },
    ],
    geography: [],
    destinations: [],
    topics: ["travel"],
    entities: [],
    language: "ko",
    observedAt: NOW,
    status: "observed",
    metadata: null,
    ...overrides,
  };
}

export function buildSyntheticResearchSignals(): RawResearchSignalInput[] {
  return [
    baseSignal({
      sourceId: OFFICIAL_JNTO_SOURCE.id,
      sourceType: "tourism_board",
      signalType: "visa",
      title: "Japan visa waiver extension for Korean travelers",
      summary: "Official tourism board update on visa-free entry conditions.",
      destinations: ["japan"],
      topics: ["visa", "travel"],
      publishedAt: "2026-09-01T00:00:00.000Z",
    }),
    baseSignal({
      sourceId: COMMUNITY_SOURCE.id,
      sourceType: "community",
      signalType: "visa",
      title: "Japan visa waiver extension for Korean travelers",
      summary: "Forum repost of the same visa update without primary link quality.",
      claim: "Official tourism board update on visa-free entry conditions.",
      destinations: ["japan"],
      topics: ["visa", "travel"],
      canonicalUrl: "https://forum.example.com/thread/999",
    }),
    baseSignal({
      sourceId: OFFICIAL_JNTO_SOURCE.id,
      sourceType: "tourism_board",
      signalType: "festival",
      title: "Sapporo Snow Festival 2026 dates announced",
      summary: "Official festival schedule published for February 2026.",
      destinations: ["sapporo", "japan"],
      topics: ["festival", "winter"],
      publishedAt: "2026-08-20T00:00:00.000Z",
    }),
    baseSignal({
      sourceId: OFFICIAL_JNTO_SOURCE.id,
      sourceType: "tourism_board",
      signalType: "weather",
      title: "Typhoon track update for Okinawa",
      summary: "Storm expected to pass near Okinawa within 24 hours.",
      destinations: ["okinawa", "japan"],
      topics: ["weather", "disruption"],
      publishedAt: "2026-08-01T00:00:00.000Z",
      observedAt: "2026-08-01T00:00:00.000Z",
    }),
    baseSignal({
      sourceId: OFFICIAL_JNTO_SOURCE.id,
      sourceType: "tourism_board",
      signalType: "event",
      title: "Expired expo ticket promotion",
      summary: "Past event promotion no longer valid.",
      destinations: ["tokyo"],
      expiresAt: "2026-08-15T00:00:00.000Z",
      observedAt: "2026-08-01T00:00:00.000Z",
    }),
    baseSignal({
      sourceId: INTERNAL_PRODUCT_SOURCE.id,
      sourceType: "internal_product",
      signalType: "internal_product",
      title: "Spain Portugal package spring departure slots open",
      summary: "Internal catalog shows new April departures for package SKU.",
      destinations: ["spain", "portugal"],
      topics: ["product", "europe"],
      commercialRelevance: {
        level: "high",
        matchedProductIds: ["98a889e9-fbc4-41e3-8302-0d2b042fbe0a"],
        confidence: 0.9,
      },
    }),
    baseSignal({
      sourceId: INTERNAL_PRODUCT_SOURCE.id,
      sourceType: "internal_product",
      signalType: "product_opportunity",
      title: "No matching SKU golf resort launch in Jeju",
      summary: "New golf resort opening signal without mapped product yet.",
      destinations: ["jeju"],
      topics: ["golf"],
      commercialRelevance: {
        level: "none",
        matchedProductIds: [],
      },
    }),
    baseSignal({
      sourceId: PERFORMANCE_SOURCE.id,
      sourceType: "performance_memory",
      signalType: "content_performance",
      title: "Japan content fatigue detected",
      summary: "Recent Japan Threads posts under baseline CTR for 14 days.",
      destinations: ["japan"],
      topics: ["performance", "fatigue"],
      evidence: [
        {
          id: randomUUID(),
          sourceId: PERFORMANCE_SOURCE.id,
          reference: "performance_snapshot:abc",
          excerpt: "CTR down 40% vs baseline",
          observedAt: NOW,
          evidenceType: "internal_record",
        },
      ],
    }),
    baseSignal({
      sourceId: COMMUNITY_SOURCE.id,
      sourceType: "community",
      signalType: "general_travel_news",
      title: "Unrelated local sports championship",
      summary: "Domestic sports league results with no travel planning impact.",
      destinations: [],
      topics: ["sports"],
    }),
    baseSignal({
      sourceId: OFFICIAL_JNTO_SOURCE.id,
      sourceType: "tourism_board",
      signalType: "airfare",
      title: "Seoul-Tokyo fare sale",
      summary: "Airline sale mentioned on official partner page.",
      destinations: ["japan"],
      externalId: "fare-sale-2026-09",
      canonicalUrl: "https://airline.example.com/sale/seoul-tokyo",
    }),
  ];
}

export function signalWithoutProvenance(): RawResearchSignalInput {
  return {
    sourceId: OFFICIAL_JNTO_SOURCE.id,
    sourceType: "tourism_board",
    signalType: "general_travel_news",
    title: "Missing evidence signal",
    summary: "No evidence rows attached.",
    evidence: [],
    geography: [],
    destinations: [],
    topics: [],
    entities: [],
    language: "ko",
    observedAt: NOW,
    status: "observed",
    metadata: null,
  };
}
