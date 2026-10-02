import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { createInMemoryContentPerformanceRepository } from "@/lib/marketing/performance/repository/inMemoryContentPerformanceRepository";
import { runResearchCollectionCycle } from "@/lib/marketing/research/collection/runResearchCollectionCycle";
import {
  EXTERNAL_RESEARCH_SOURCE_REGISTRY,
  RESEARCH_SOURCE_REGISTRY,
  createDefaultResearchCollectors,
  createResearchCollectorForSource,
  mapRawResearchItemToSignalInput,
  projectResearchSource,
  toConfiguredRssCollectorConfig,
} from "@/lib/marketing/research/collectors";
import { collectUniqueArticleAgendaCandidates } from "@/lib/marketing/research/manager/collectUniqueArticleAgendaCandidates";
import { getMarketingManagerResearchContext } from "@/lib/marketing/research/manager/getMarketingManagerResearchContext";
import { resolveSourceRoleWeights } from "@/lib/marketing/research/portfolio/sourcePortfolioRoles";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import { normalizeResearchSignal } from "@/lib/marketing/research/services/normalizer";
import { aggregateBiasAdjustedAgendaSeedWeight } from "@/lib/marketing/research/sourceCommercialBias";
import { adaptTrendSignalToResearch, persistAdaptedTrend } from "@/lib/marketing/trends/adapter/trendSourceAdapter";
import { FIXTURE_BUSAN_FAMILY_CRUISE } from "@/lib/marketing/trends/fixtures/positiveFixtures";
import { PARITY_FIXTURE_BY_FEED, mockFeedFetch } from "@/lib/marketing/research/__tests__/sourceRegistryParityFixtures";

const NOW = new Date("2026-10-01T09:00:00.000Z");
const ISO = NOW.toISOString();
const REGISTRY_IDS = new Set(RESEARCH_SOURCE_REGISTRY.map((s) => s.id));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VOLATILE = new Set(["id", "createdAt", "updatedAt", "startedAt", "completedAt", "cycleId", "durationMs", "requestedAt", "generatedAt"]);

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, VOLATILE.has(k) ? "<v>" : stable(v)]));
  }
  if (typeof value === "string" && UUID.test(value) && !REGISTRY_IDS.has(value)) return "<uuid>";
  return value;
}
const sortedJson = (list: readonly unknown[]) => list.map((e) => JSON.stringify(stable(e))).sort();

async function seedPerf(repo: ReturnType<typeof createInMemoryContentPerformanceRepository>) {
  for (const [i, origin] of (["human_edited", "ai_unchanged"] as const).entries()) {
    await repo.save({
      snapshot: {
        collectionId: `pcol_6b1_${i}`,
        logicalObservationKey: `6b1-obs-${i}`,
        candidateId: `cmc_6b1_${i}`,
        humanReviewId: `hmr_6b1_${i}`,
        platform: "threads",
        channel: "threads",
        externalPostId: `6b1_post_${i}`,
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

describe("6B-2 deterministic runtime parity", () => {
  it("preserves scores, ordering and fingerprints while recording collector language provenance", async () => {
    const out: Record<string, unknown> = {};

    const items = [];
    for (const source of EXTERNAL_RESEARCH_SOURCE_REGISTRY) {
      const collector = createResearchCollectorForSource(source, { fetchImpl: mockFeedFetch(PARITY_FIXTURE_BY_FEED) });
      for (const item of await collector.collect({ sourceId: source.id, sourceType: source.sourceType, now: NOW, maxItems: 25 })) {
        const mapped = mapRawResearchItemToSignalInput(item, { sourceId: source.id, sourceType: source.sourceType });
        const normalized = mapped
          ? normalizeResearchSignal(mapped, { ...projectResearchSource(source), createdAt: ISO, updatedAt: ISO }, NOW)
          : null;
        items.push({ key: source.key, item, mapped, normalized });
      }
    }
    out.items = stable(items);
    out.configs = EXTERNAL_RESEARCH_SOURCE_REGISTRY.filter((s) => s.collector.mapperProfile === "generic").map(toConfiguredRssCollectorConfig);

    const repo = createInMemoryResearchRepository();
    const perfRepoRaw = createInMemoryContentPerformanceRepository();
    await seedPerf(perfRepoRaw);
    const fixId = <T extends { snapshotId: string; logicalObservationKey: string }>(s: T): T => ({ ...s, snapshotId: `snap-${s.logicalObservationKey}` });
    const perfRepo = {
      ...perfRepoRaw,
      listRecent: async (i: { since?: string; limit?: number }) => (await perfRepoRaw.listRecent(i)).map(fixId),
      findByCandidateId: async (c: string) => (await perfRepoRaw.findByCandidateId(c)).map(fixId),
      findByLogicalObservationKey: async (k: string) => {
        const s = await perfRepoRaw.findByLogicalObservationKey(k);
        return s ? fixId(s) : null;
      },
    };
    const cycle = await runResearchCollectionCycle({
      repo,
      performanceRepo: perfRepo,
      now: NOW,
      env: { RESEARCH_COLLECTION_ENABLED: "true" },
      collectors: createDefaultResearchCollectors({ fetchImpl: mockFeedFetch(PARITY_FIXTURE_BY_FEED) }),
    });
    out.cycle = {
      status: cycle.status,
      collectorResults: stable(cycle.collectorResults),
      totals: cycle.totals,
      normalized: sortedJson(cycle.pipeline?.normalized ?? []),
      rejected: sortedJson(cycle.pipeline?.rejected ?? []),
      enriched: sortedJson(cycle.pipeline?.enriched ?? []),
      duplicates: sortedJson(cycle.pipeline?.duplicates ?? []),
      briefs: sortedJson(cycle.pipeline?.briefs ?? []),
      candidates: sortedJson(cycle.pipeline?.agendaCandidates ?? []),
      candidateOrder: (cycle.pipeline?.agendaCandidates ?? []).map((c) => c.title),
    };

    const meta = await persistAdaptedTrend(adaptTrendSignalToResearch(FIXTURE_BUSAN_FAMILY_CRUISE, NOW), repo);
    out.meta = stable({ signal: meta.signal, brief: meta.brief, agendaCandidate: meta.agendaCandidate, persisted: meta.persisted });

    const sources = [];
    for (const def of RESEARCH_SOURCE_REGISTRY) {
      const stored = await repo.getSourceById(def.id);
      sources.push({
        id: def.id,
        stored: stable(stored),
        role: stored ? resolveSourceRoleWeights(stored) : null,
        seed: stored ? aggregateBiasAdjustedAgendaSeedWeight([stored]) : null,
      });
    }
    out.sources = sources;

    const stored = await repo.findRecentSignals({ since: "1970-01-01T00:00:00.000Z", limit: 100_000 });
    out.storedSignals = sortedJson(stored);
    out.fingerprints = stored.map((s) => `${s.rawFingerprint}|${s.normalizedFingerprint}|${s.status}`).sort();

    const since = new Date(NOW.getTime() - 168 * 3_600_000).toISOString();
    const prePool = await collectUniqueArticleAgendaCandidates(repo, { since, targetUniqueArticles: 180 });
    out.prePool = { titles: prePool.candidates.map((c) => c.title), stats: stable(omit(prePool, ["candidates"])) };

    const logs: unknown[] = [];
    const spy = vi.spyOn(console, "info").mockImplementation((tag: unknown, payload: unknown) => {
      if (typeof payload === "string" && String(tag).includes("mm")) logs.push(JSON.parse(payload));
    });
    try {
      for (const limit of [18, 30]) {
        const mm = await getMarketingManagerResearchContext(
          { lookbackHours: 168, limit },
          { repo, now: NOW, checkSemanticInfrastructure: async () => false },
        );
        out[`mm${limit}`] = stable(mm);
      }
    } finally {
      spy.mockRestore();
    }
    out.mmLogs = stable(logs);

    // Frozen pre-cleanup capture, not a snapshot regenerated from the current implementation.
    // Random ids/timestamps are normalized by stable(); ordering, scores, provenance and
    // raw/normalized fingerprints remain part of the comparison.
    const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/phase6b1Before.json"), "utf8"));
    for (const source of baseline.sources) {
      delete source.stored.metadata.destinationFocus;
      if (source.stored.metadata.portfolio) delete source.stored.metadata.portfolio.evidenceAuthorityWeight;
      delete source.role.evidenceAuthorityWeight;
    }
    for (const key of ["mm18", "mm30"]) {
      const attenuation = baseline[key].observability.agendaSeedAttenuation;
      attenuation.attenuatedCandidateCount = attenuation.attenuatedRankedCount;
    }
    for (const log of baseline.mmLogs) {
      if (log.event === "agenda_seed_attenuation") log.attenuatedCandidateCount = log.attenuatedRankedCount;
    }
    const feedIds = new Set(EXTERNAL_RESEARCH_SOURCE_REGISTRY.map((source) => source.id));
    // Phase 6B-2 intentionally stops stamping a source default on raw feed items.
    for (const entry of baseline.items) {
      entry.item.language = null;
      entry.mapped.language = null;
      if (entry.normalized?.ok) entry.normalized.signal.metadata.languageFallbackApplied = true;
    }
    for (const config of baseline.configs) {
      config.isOfficial = EXTERNAL_RESEARCH_SOURCE_REGISTRY.find((source) => source.id === config.sourceId)!.isOfficial;
    }
    // These collections are serialized by the original capture. Preserve all other fields,
    // including values and fingerprints; only feed signal provenance gains this flag.
    const withLanguageProvenance = (entry: string): string => {
      const signal = JSON.parse(entry);
      if (feedIds.has(signal.sourceId) && signal.rawFingerprint) {
        signal.metadata = { ...signal.metadata, languageFallbackApplied: true };
      }
      return JSON.stringify(signal);
    };
    for (const key of ["normalized", "enriched", "duplicates"]) {
      baseline.cycle[key] = baseline.cycle[key].map(withLanguageProvenance).sort();
    }
    baseline.storedSignals = baseline.storedSignals.map(withLanguageProvenance).sort();
    expect(out).toEqual(baseline);
  });
});

function omit(value: object, keys: string[]) {
  return Object.fromEntries(Object.entries(value).filter(([k]) => !keys.includes(k)));
}
