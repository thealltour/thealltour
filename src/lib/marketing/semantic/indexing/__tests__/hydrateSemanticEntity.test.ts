vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import { createInMemoryDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import type { AgendaCandidate, ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import { MARKETING_SEMANTIC_SOURCE_TEXT_VERSION } from "@/lib/marketing/semantic/entityEmbeddings/types";
import { hydrateSemanticEntityForIndexing } from "@/lib/marketing/semantic/indexing/hydrateSemanticEntity";

const NOW = "2026-09-06T12:00:00.000Z";

function makeBrief(): ResearchBrief {
  return {
    id: "rb_1",
    title: "Title",
    summary: "Summary text",
    signalIds: [],
    claims: ["claim-a"],
    evidence: [],
    topics: ["topic"],
    destinations: ["Japan"],
    entities: [],
    freshness: { observedAt: NOW },
    credibility: { score: 0.5, level: "medium", reasons: [] },
    travelRelevance: { score: 0.5, reasons: [] },
    publicInterest: 0.5,
    risks: [],
    openQuestions: ["q1"],
    generatedAt: NOW,
    status: "active",
  };
}

function makeAgenda(): AgendaCandidate {
  return {
    id: "ac_1",
    researchBriefId: "rb_1",
    title: "Agenda",
    rationale: "Why",
    freshnessScore: 0.5,
    publicInterestScore: 0.5,
    travelRelevanceScore: 0.5,
    credibilityScore: 0.5,
    compositeResearchScore: 0.5,
    scoreReasons: ["why"],
    riskFlags: [],
    supportingEvidenceIds: [],
    status: "candidate",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("hydrateSemanticEntityForIndexing", () => {
  it("hydrates research_brief without caller-built canonical text", async () => {
    const researchRepo = createInMemoryResearchRepository();
    await researchRepo.upsertBrief(makeBrief());
    const result = await hydrateSemanticEntityForIndexing(
      { entityType: "research_brief", entityId: "rb_1" },
      {
        researchRepo,
        runRepo: createInMemoryDailyMarketingRunRepository(),
        sourceTextVersion: MARKETING_SEMANTIC_SOURCE_TEXT_VERSION,
      },
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.entity.canonicalText).toContain("title:Title");
    expect(result.entity.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.entity.sourceTextVersion).toBe("v1");
  });

  it("returns not_found for missing agenda_candidate", async () => {
    const result = await hydrateSemanticEntityForIndexing(
      { entityType: "agenda_candidate", entityId: "missing" },
      {
        researchRepo: createInMemoryResearchRepository(),
        runRepo: createInMemoryDailyMarketingRunRepository(),
        sourceTextVersion: "v1",
      },
    );
    expect(result).toEqual(
      expect.objectContaining({ status: "unavailable", reason: "not_found" }),
    );
  });

  it("hydrates agenda_candidate with linked brief destinations/topics", async () => {
    const researchRepo = createInMemoryResearchRepository();
    await researchRepo.upsertBrief(makeBrief());
    await researchRepo.upsertAgendaCandidate(makeAgenda());
    const result = await hydrateSemanticEntityForIndexing(
      { entityType: "agenda_candidate", entityId: "ac_1" },
      {
        researchRepo,
        runRepo: createInMemoryDailyMarketingRunRepository(),
        sourceTextVersion: "v1",
      },
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.entity.canonicalText).toContain("dest:japan");
    expect(result.entity.canonicalText).toContain("topics:topic");
  });
});
