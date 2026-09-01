import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { randomUUID } from "node:crypto";

import { bootstrapResearchSources } from "@/lib/marketing/research/collection/bootstrapSources";
import { runResearchCollectionCycle } from "@/lib/marketing/research/collection/runResearchCollectionCycle";
import {
  NYT_TRAVEL_RSS_SAMPLE,
  UK_GOV_ATOM_SAMPLE,
} from "@/lib/marketing/research/__tests__/feedFixtures";
import {
  NYT_TRAVEL_FEED_URL,
  UK_GOV_TRAVEL_FEED_URL,
} from "@/lib/marketing/research/collectors/config";
import { createNytTravelRssCollector } from "@/lib/marketing/research/collectors/nytTravelRssCollector";
import { createUkGovTravelAdviceCollector } from "@/lib/marketing/research/collectors/ukGovTravelAdviceCollector";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import { normalizeResearchSignal } from "@/lib/marketing/research/services/normalizer";
import { MVP_RESEARCH_SOURCES } from "@/lib/marketing/research/collectors/config";

const NOW = new Date("2026-09-02T00:00:00.000Z");

function mockFetch(payload: Record<string, string>) {
  return vi.fn(async (url: string | URL) => {
    const key = String(url);
    const body = payload[key];
    if (!body) {
      return {
        ok: false,
        status: 404,
        headers: { get: () => null },
        body: null,
      };
    }
    const encoded = new TextEncoder().encode(body);
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/xml" },
      body: {
        getReader: () => {
          let done = false;
          return {
            read: async () => {
              if (done) return { done: true, value: undefined };
              done = true;
              return { done: false, value: encoded };
            },
          };
        },
      },
    };
  }) as unknown as typeof fetch;
}

describe("research collection cycle", () => {
  it("runs end-to-end synthetic integration with mocked feeds", async () => {
    const repo = createInMemoryResearchRepository();
    const fetchImpl = mockFetch({
      [UK_GOV_TRAVEL_FEED_URL]: UK_GOV_ATOM_SAMPLE,
      [NYT_TRAVEL_FEED_URL]: NYT_TRAVEL_RSS_SAMPLE,
    });

    const result = await runResearchCollectionCycle({
      repo,
      collectors: [
        createUkGovTravelAdviceCollector({ fetchImpl }),
        createNytTravelRssCollector({ fetchImpl }),
      ],
      now: NOW,
      env: { RESEARCH_COLLECTION_ENABLED: "true" },
    });

    expect(result.status).toBe("success");
    expect(result.totals.rawItems).toBeGreaterThanOrEqual(2);
    expect(result.totals.accepted).toBeGreaterThanOrEqual(2);
    expect(result.pipeline?.briefs.length).toBeGreaterThan(0);
    expect(result.pipeline?.agendaCandidates.length).toBeGreaterThan(0);
  });

  it("isolates one collector failure without erasing successful source", async () => {
    const repo = createInMemoryResearchRepository();
    await bootstrapResearchSources(repo, NOW);

    const fetchImpl = vi.fn(async (url: string | URL) => {
      if (String(url) === UK_GOV_TRAVEL_FEED_URL) {
        const encoded = new TextEncoder().encode(UK_GOV_ATOM_SAMPLE);
        return {
          ok: true,
          status: 200,
          headers: { get: () => "application/atom+xml" },
          body: {
            getReader: () => {
              let done = false;
              return {
                read: async () => {
                  if (done) return { done: true, value: undefined };
                  done = true;
                  return { done: false, value: encoded };
                },
              };
            },
          },
        };
      }
      return {
        ok: false,
        status: 500,
        headers: { get: () => null },
        body: null,
      };
    }) as unknown as typeof fetch;

    const result = await runResearchCollectionCycle({
      repo,
      collectors: [
        createUkGovTravelAdviceCollector({ fetchImpl }),
        createNytTravelRssCollector({ fetchImpl }),
      ],
      now: NOW,
      env: { RESEARCH_COLLECTION_ENABLED: "true" },
      maxItemsPerCollector: 5,
    });

    expect(result.status).toBe("partial_success");
    expect(result.totals.accepted).toBeGreaterThan(0);
    expect(result.collectorResults.some((r) => r.status === "failed")).toBe(true);
    expect(result.collectorResults.some((r) => r.status === "success")).toBe(true);
  });

  it("supports idempotent second ingestion", async () => {
    const repo = createInMemoryResearchRepository();
    await bootstrapResearchSources(repo, NOW);
    const source = MVP_RESEARCH_SOURCES[0]!;
    const raw = {
      sourceId: source.id,
      sourceType: source.sourceType,
      signalType: "entry_requirement" as const,
      title: "Japan visa update",
      summary: "Official visa guidance updated for travelers.",
      claim: "Official visa guidance updated for travelers.",
      claimSource: "source" as const,
      evidence: [
        {
          id: randomUUID(),
          sourceId: source.id,
          url: "https://www.gov.uk/foreign-travel-advice/japan",
          excerpt: "Official visa guidance updated for travelers.",
          observedAt: NOW.toISOString(),
          evidenceType: "official_statement" as const,
        },
      ],
      canonicalUrl: "https://www.gov.uk/foreign-travel-advice/japan",
      externalId: "gov-japan-1",
      geography: [],
      destinations: ["japan"],
      topics: ["visa", "travel"],
      entities: [],
      language: "en",
      observedAt: NOW.toISOString(),
      metadata: null,
    };

    const first = normalizeResearchSignal(raw, { ...source, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() }, NOW);
    expect(first.ok).toBe(true);
    await repo.upsertSignal(first.signal);
    const countBefore = (await repo.findEligibleSignals()).length;

    const second = normalizeResearchSignal(
      { ...raw, observedAt: new Date("2026-09-02T01:00:00.000Z").toISOString() },
      { ...source, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() },
      new Date("2026-09-02T01:00:00.000Z"),
    );
    expect(second.ok).toBe(true);
    await repo.upsertSignal(second.signal);

    const byFingerprint = await repo.findByFingerprint(first.signal.rawFingerprint);
    expect(byFingerprint?.id).toBe(first.signal.id);
    expect(byFingerprint?.observedAt).toBe("2026-09-02T01:00:00.000Z");

    const allSignals = await repo.findRecentSignals({ since: "2026-09-01T00:00:00.000Z" });
    const sameFingerprint = allSignals.filter((s) => s.rawFingerprint === first.signal.rawFingerprint);
    expect(sameFingerprint).toHaveLength(1);
    expect(countBefore).toBeGreaterThanOrEqual(0);
  });
});
