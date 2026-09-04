vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import {
  buildCompactManagerSlateCurationPayload,
  buildLegacyManagerAgendaSlateCurationPrompt,
  buildManagerAgendaSlateCurationPrompt,
  measureManagerSlateCurationPromptBytes,
  parseManagerAgendaSlateCuration,
  pickRepresentativeEvidence,
} from "@/lib/marketing/cron/daily/agendaSlate/curateManagerAgendaSlate";
import {
  agendaCandidate,
  buildResearchContext,
  officialEvidence,
  PRODUCT,
  researchBrief,
  NOW,
} from "@/lib/marketing/cron/daily/__tests__/fixtures";
import { runDailyMarketingAgendaSlate } from "@/lib/marketing/cron/daily/runDailyMarketingAgendaSlate";
import {
  createInMemoryDailyAgendaSlateRepository,
  resetDefaultDailyAgendaSlateRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyAgendaSlateRepository";
import {
  createInMemoryDailyMarketingRunRepository,
  resetDefaultDailyMarketingRunRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { createInMemoryHumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import type { CompactManagerAgendaCandidate, CompactManagerEvidenceRef } from "@/lib/marketing/research/manager/types";

const DAY = "2026-09-02";

function fatCandidate(n: number, evidence: CompactManagerEvidenceRef[]): CompactManagerAgendaCandidate {
  const longSummary = `Summary for topic ${n}. ${"Travel detail. ".repeat(40)}`;
  return {
    ...agendaCandidate,
    agendaCandidateId: `ac-item-${n}`,
    researchBriefId: `rb-item-${n}`,
    title: `Travel topic ${n}`,
    summary: longSummary,
    destinations: ["Japan", "Korea", "UK"],
    topics: ["visa", "autumn", "rail", "festival"],
    signalTypes: ["official_update", "news"],
    matchedProductIds: n % 2 === 0 ? [PRODUCT] : [],
    riskFlags: n === 3 ? ["stale_signal"] : [],
    evidence,
    totalResearchScore: 0.5 + n * 0.01,
  };
}

function duplicateEvidenceBundle(): CompactManagerEvidenceRef[] {
  const base = {
    ...officialEvidence,
    url: "https://example.com/same-article",
    excerpt: "Identical autumn travel guidance repeated three times.",
  };
  return [
    { ...base, evidenceId: "ev-a" },
    { ...base, evidenceId: "ev-b" },
    { ...base, evidenceId: "ev-c", isOfficial: false, sourceName: "Mirror" },
  ];
}

function fatResearchContext(count = 8) {
  const evidence = duplicateEvidenceBundle();
  const agendaCandidates = Array.from({ length: count }, (_, i) => fatCandidate(i + 1, evidence));
  const briefs = agendaCandidates.map((c) => ({
    ...researchBrief,
    researchBriefId: c.researchBriefId,
    title: c.title,
    summary: c.summary,
    evidence,
    risks: c.riskFlags,
    commercialRelevance: {
      level: c.matchedProductIds.length ? "high" : "low",
      matchedProductIds: c.matchedProductIds,
    },
  }));
  return buildResearchContext({
    agendaCandidates,
    briefs,
    notes: ["fat research fixture"],
    observability: {
      requestedAt: NOW.toISOString(),
      candidateCount: count,
      briefCount: count,
      topScore: 0.8,
      degraded: false,
      staleExcludedCount: 0,
      duplicateExcludedCount: 0,
    },
  });
}

function managerCurateJson(ids: number[]) {
  return JSON.stringify({
    decision: "curate",
    managerMessage: "curated for korean travelers",
    items: ids.map((n) => ({
      agendaCandidateId: `ac-item-${n}`,
      researchBriefId: `rb-item-${n}`,
      title: `Travel topic ${n}`,
      summary: `Summary for topic ${n} with enough detail.`,
      rationale: [`MM pick ${n}`, "why now for KR travelers"],
      freshnessWhyNow: `Fresh signal ${n}`,
      koreanTravelerRelevance: "High for KR outbound",
      practicalTravelValue: "Actionable tips",
      theAllTourBusinessRelevance: "Informational brand fit",
      contentPotential: "Threads short post",
      recommendedFormats: ["threads_text"],
      recommendedChannel: "threads",
    })),
  });
}

describe("compact MM slate curation payload", () => {
  it("C: compact payload keeps stable IDs needed for selection", () => {
    const research = fatResearchContext(6);
    const payload = buildCompactManagerSlateCurationPayload(research, 6);
    expect(payload.agendaCandidates).toHaveLength(6);
    for (const row of payload.agendaCandidates) {
      expect(row.agendaCandidateId).toMatch(/^ac-item-/);
      expect(row.researchBriefId).toMatch(/^rb-item-/);
      expect(row.title).toBeTruthy();
      expect(row.summary).toBeTruthy();
    }
  });

  it("D: duplicate evidence collapses to one representative excerpt", () => {
    const evidence = duplicateEvidenceBundle();
    expect(evidence).toHaveLength(3);
    const picked = pickRepresentativeEvidence(evidence);
    expect(picked).not.toBeNull();
    expect(picked!.url).toBe("https://example.com/same-article");
    expect(picked!.isOfficial).toBe(true);
    expect(picked!.evidenceId).toBe("ev-a");

    const payload = buildCompactManagerSlateCurationPayload(fatResearchContext(3), 6);
    for (const row of payload.agendaCandidates) {
      expect(row.representativeEvidence?.url).toBe("https://example.com/same-article");
    }
    const prompt = buildManagerAgendaSlateCurationPrompt(fatResearchContext(3));
    const matches = prompt.match(/https:\/\/example\.com\/same-article/g) ?? [];
    // one URL per candidate, not three duplicates each
    expect(matches.length).toBe(3);
  });

  it("E: full duplicate briefs are not sent", () => {
    const research = fatResearchContext(6);
    const prompt = buildManagerAgendaSlateCurationPrompt(research);
    const payload = buildCompactManagerSlateCurationPayload(research);
    expect(payload.briefsOmitted).toBe(true);
    expect(prompt).toContain('"briefsOmitted":true');
    expect(prompt).not.toContain('"briefs":');
    expect(prompt).not.toContain('"openQuestions"');
    // legacy still embeds briefs for measurement baseline
    expect(buildLegacyManagerAgendaSlateCurationPrompt(research)).toContain('"briefs":');
  });

  it("F: MM output parser/schema behavior remains unchanged", () => {
    const research = fatResearchContext(8);
    const parsed = parseManagerAgendaSlateCuration(managerCurateJson([2, 4, 6, 8, 1, 3]), research, 6);
    expect(parsed.outcome).toBe("curated");
    if (parsed.outcome !== "curated") return;
    expect(parsed.items.map((i) => i.agendaCandidateId)).toEqual([
      "ac-item-2",
      "ac-item-4",
      "ac-item-6",
      "ac-item-8",
      "ac-item-1",
      "ac-item-3",
    ]);
    expect(parsed.managerMessage).toContain("korean travelers");
  });

  it("reports substantial prompt size reduction vs legacy dump", () => {
    const research = fatResearchContext(8);
    const sizes = measureManagerSlateCurationPromptBytes(research, 6);
    expect(sizes.candidateCount).toBe(8);
    expect(sizes.compactBytes).toBeLessThan(sizes.legacyBytes);
    expect(sizes.compactBytes / sizes.legacyBytes).toBeLessThan(0.7);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        legacyBytes: sizes.legacyBytes,
        compactBytes: sizes.compactBytes,
        ratio: Number((sizes.compactBytes / sizes.legacyBytes).toFixed(3)),
      }),
    );
  });
});

describe("MM curation reliability fallback + human boundary", () => {
  it("G: deterministic fallback still works on manager invoke failure", async () => {
    resetDefaultDailyMarketingRunRepository();
    resetDefaultDailyAgendaSlateRepository();
    const repo = createInMemoryDailyMarketingRunRepository();
    const slateRepo = createInMemoryDailyAgendaSlateRepository();
    const result = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: DAY },
      {
        repo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => fatResearchContext(6),
        invokeManagerProfile: async () => {
          throw new Error("marketing-manager timed out after 180000ms");
        },
      },
    );
    expect(result.slate?.curation.mode).toBe("deterministic_fallback");
    expect(result.slate?.curation.managerMessage).toContain(
      "manager_curation_error:marketing-manager timed out after 180000ms",
    );
    expect(result.slate?.candidates.length).toBeGreaterThanOrEqual(5);
    expect(result.slate?.status).toBe("ready_for_human_selection");
  });

  it("H: slate-only Human boundary remains intact (no HMR / production candidate)", async () => {
    resetDefaultDailyMarketingRunRepository();
    resetDefaultDailyAgendaSlateRepository();
    const repo = createInMemoryDailyMarketingRunRepository();
    const slateRepo = createInMemoryDailyAgendaSlateRepository();
    const reviewRepo = createInMemoryHumanMarketingReviewRepository();
    const result = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: DAY },
      {
        repo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => fatResearchContext(6),
        invokeManagerProfile: async () => managerCurateJson([1, 2, 3, 4, 5, 6]),
      },
    );
    expect(result.candidate).toBeNull();
    expect(await repo.findCandidateByLogicalKey(result.run.logicalRunKey)).toBeNull();
    expect(await reviewRepo.listReviews({ limit: 10 })).toEqual([]);
    expect(result.slate?.status).toBe("ready_for_human_selection");
  });
});
