import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { signalFixture } from "@/lib/marketing/research/__tests__/semanticCalibrationFixtures";
import { MVP_RESEARCH_SOURCES } from "@/lib/marketing/research/collectors/config";
import { getMarketingManagerResearchContext } from "@/lib/marketing/research/manager/getMarketingManagerResearchContext";
import {
  buildAgendaCandidateFromBrief,
  rankAgendaCandidates,
} from "@/lib/marketing/research/services/agendaCandidateBuilder";
import { buildResearchBriefFromCluster } from "@/lib/marketing/research/services/briefBuilder";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

const NOW = new Date("2026-09-02T12:00:00.000Z");

async function seedRepo() {
  const repo = createInMemoryResearchRepository();
  const sources: ResearchSource[] = MVP_RESEARCH_SOURCES.map((s) => ({
    ...s,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  }));
  for (const source of sources) {
    await repo.upsertSource(source);
  }

  const officialSignal = signalFixture({
    id: "11111111-1111-4111-8111-111111111801",
    title: "Indonesia travel advisory",
    summary: "Official Indonesia travel advisory update.",
    signalType: "safety",
    destinations: ["indonesia"],
    sourceId: MVP_RESEARCH_SOURCES[0]!.id,
    sourceType: "official_government",
    evidence: [
      {
        id: "ev-official-1",
        sourceId: MVP_RESEARCH_SOURCES[0]!.id,
        url: "https://example.gov/indonesia",
        excerpt: "Official advisory excerpt.",
        observedAt: NOW.toISOString(),
        evidenceType: "official_statement",
      },
    ],
  });

  const productlessSignal = signalFixture({
    id: "22222222-2222-4222-8222-222222222802",
    title: "Grand Canyon flood safety tips",
    summary: "Useful travel safety information without product linkage.",
    signalType: "general_travel_news",
    destinations: ["grand-canyon"],
    sourceId: MVP_RESEARCH_SOURCES[1]!.id,
    sourceType: "news",
    travelRelevance: { score: 0.78, reasons: ["travel_topic_keyword"] },
    publicInterestScore: 0.62,
    commercialRelevance: undefined,
    rawFingerprint: "gc-news",
    normalizedFingerprint: "gc-news-n",
    evidence: [
      {
        id: "ev-news-1",
        sourceId: MVP_RESEARCH_SOURCES[1]!.id,
        url: "https://example.com/grand-canyon",
        excerpt: "News excerpt about flood safety.",
        observedAt: NOW.toISOString(),
        evidenceType: "direct_source",
      },
    ],
  });

  const lowCredSignal = signalFixture({
    id: "33333333-3333-4333-8333-333333333803",
    title: "Unverified rumor",
    summary: "Low credibility community rumor.",
    signalType: "general_travel_news",
    destinations: ["spain"],
    sourceType: "community",
    credibility: { score: 0.25, level: "low", reasons: ["community"] },
    rawFingerprint: "rumor",
    normalizedFingerprint: "rumor-n",
  });

  const staleSignal = signalFixture({
    id: "44444444-4444-4444-8444-444444444804",
    title: "Old promo",
    summary: "Stale commercial promo.",
    signalType: "internal_product",
    destinations: ["spain"],
    freshness: { observedAt: NOW.toISOString(), freshnessScore: 0.05 },
    commercialRelevance: { level: "high", matchedProductIds: ["prod-1"], confidence: 0.9 },
    rawFingerprint: "stale",
    normalizedFingerprint: "stale-n",
  });

  for (const signal of [officialSignal, productlessSignal, lowCredSignal, staleSignal]) {
    await repo.upsertSignal(signal);
  }

  const officialBrief = buildResearchBriefFromCluster({
    cluster: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa81",
      primarySignalId: officialSignal.id,
      signalIds: [officialSignal.id],
      clusterType: "event",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    },
    signals: [officialSignal],
    sources: new Map(sources.map((s) => [s.id, s])),
    now: NOW,
  })!;

  const productlessBrief = buildResearchBriefFromCluster({
    cluster: {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb81",
      primarySignalId: productlessSignal.id,
      signalIds: [productlessSignal.id],
      clusterType: "event",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    },
    signals: [productlessSignal],
    sources: new Map(sources.map((s) => [s.id, s])),
    now: NOW,
  })!;

  const lowBrief = buildResearchBriefFromCluster({
    cluster: {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccc81",
      primarySignalId: lowCredSignal.id,
      signalIds: [lowCredSignal.id],
      clusterType: "event",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    },
    signals: [lowCredSignal],
    sources: new Map(sources.map((s) => [s.id, s])),
    now: NOW,
  })!;

  const staleBrief = buildResearchBriefFromCluster({
    cluster: {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddd81",
      primarySignalId: staleSignal.id,
      signalIds: [staleSignal.id],
      clusterType: "event",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    },
    signals: [staleSignal],
    sources: new Map(sources.map((s) => [s.id, s])),
    now: NOW,
  })!;

  for (const brief of [officialBrief, productlessBrief, lowBrief, staleBrief]) {
    await repo.upsertBrief(brief);
  }

  const candidates = rankAgendaCandidates([
    buildAgendaCandidateFromBrief(staleBrief, NOW),
    buildAgendaCandidateFromBrief(lowBrief, NOW),
    buildAgendaCandidateFromBrief(productlessBrief, NOW),
    buildAgendaCandidateFromBrief(officialBrief, NOW),
  ]);

  for (const candidate of candidates) {
    await repo.upsertAgendaCandidate(candidate);
  }

  const duplicateCandidate = buildAgendaCandidateFromBrief(officialBrief, NOW);
  duplicateCandidate.id = "55555555-5555-4555-8555-555555555555";
  duplicateCandidate.createdAt = NOW.toISOString();
  duplicateCandidate.updatedAt = NOW.toISOString();
  await repo.upsertAgendaCandidate(duplicateCandidate);

  return { repo, officialBrief, productlessBrief, lowBrief };
}

describe("Marketing Manager research context service", () => {
  it("returns bounded Top-N with Korean-outbound soft ranking while keeping official evidence", async () => {
    const { repo, officialBrief, productlessBrief } = await seedRepo();
    const context = await getMarketingManagerResearchContext(
      { limit: 5 },
      { repo, now: NOW, checkSemanticInfrastructure: async () => true },
    );

    expect(context.status).toBe("ok");
    expect(context.agendaCandidates.length).toBeGreaterThan(0);
    // Grand Canyon (KR FIT safety) may outrank FCDO Indonesia as an agenda seed,
    // but official FCDO evidence must remain available in the pool.
    const ids = context.agendaCandidates.map((c) => c.researchBriefId);
    expect(ids).toContain(productlessBrief.id);
    expect(ids).toContain(officialBrief.id);
    const official = context.agendaCandidates.find((c) => c.researchBriefId === officialBrief.id)!;
    expect(official.credibilityScore).toBeGreaterThan(0.85);
    expect(typeof context.agendaCandidates[0]!.koreanOutboundRelevanceScore).toBe("number");
  });

  it("keeps productless high-relevance candidate in context", async () => {
    const { repo, productlessBrief } = await seedRepo();
    const context = await getMarketingManagerResearchContext(
      { limit: 5 },
      { repo, now: NOW, checkSemanticInfrastructure: async () => true },
    );

    const productless = context.agendaCandidates.find(
      (c) => c.researchBriefId === productlessBrief.id,
    );
    expect(productless).toBeTruthy();
    expect(productless!.matchedProductIds).toHaveLength(0);
    expect(productless!.travelRelevanceScore).toBeGreaterThan(0.75);
  });

  it("ranks low credibility candidate below stronger evidence", async () => {
    const { repo, lowBrief, officialBrief } = await seedRepo();
    const context = await getMarketingManagerResearchContext(
      { limit: 5 },
      { repo, now: NOW, checkSemanticInfrastructure: async () => true },
    );

    const officialIdx = context.agendaCandidates.findIndex(
      (c) => c.researchBriefId === officialBrief.id,
    );
    const lowIdx = context.agendaCandidates.findIndex((c) => c.researchBriefId === lowBrief.id);
    expect(officialIdx).toBeGreaterThanOrEqual(0);
    expect(lowIdx).toBeGreaterThan(officialIdx);
  });

  it("excludes stale research from manager context", async () => {
    const { repo } = await seedRepo();
    const context = await getMarketingManagerResearchContext(
      { limit: 10 },
      { repo, now: NOW, checkSemanticInfrastructure: async () => true },
    );

    expect(context.agendaCandidates.every((c) => c.freshnessScore >= 0.15)).toBe(true);
    expect(context.observability.staleExcludedCount).toBeGreaterThan(0);
  });

  it("deduplicates manager items by research brief", async () => {
    const { repo } = await seedRepo();
    const context = await getMarketingManagerResearchContext(
      { limit: 10 },
      { repo, now: NOW, checkSemanticInfrastructure: async () => true },
    );

    const ids = context.agendaCandidates.map((c) => c.researchBriefId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(context.observability.duplicateExcludedCount).toBeGreaterThan(0);
  });

  it("preserves cluster evidence union and score components", async () => {
    const { repo, productlessBrief } = await seedRepo();
    const context = await getMarketingManagerResearchContext(
      { limit: 5 },
      { repo, now: NOW, checkSemanticInfrastructure: async () => true },
    );

    const item = context.agendaCandidates.find((c) => c.researchBriefId === productlessBrief.id)!;
    expect(item.evidence.length).toBeGreaterThan(0);
    expect(item.evidence[0]!.url).toContain("grand-canyon");
    expect(item.researchScoreComponents).toBeTruthy();
    expect(item.scoreReasons.length).toBeGreaterThan(0);
  });

  it("returns explicit empty state when no eligible research exists", async () => {
    const repo = createInMemoryResearchRepository();
    const context = await getMarketingManagerResearchContext(
      { limit: 5 },
      { repo, now: NOW, checkSemanticInfrastructure: async () => true },
    );

    expect(context.status).toBe("empty");
    expect(context.agendaCandidates).toHaveLength(0);
    expect(context.notes).toContain("no_eligible_research_in_window");
  });

  it("marks degraded when semantic infrastructure unavailable but data exists", async () => {
    const { repo } = await seedRepo();
    const context = await getMarketingManagerResearchContext(
      { limit: 5 },
      { repo, now: NOW, checkSemanticInfrastructure: async () => false },
    );

    expect(context.status).toBe("degraded");
    expect(context.agendaCandidates.length).toBeGreaterThan(0);
    expect(context.degradedState?.semanticInfrastructureAvailable).toBe(false);
  });
});
