import { describe, expect, it, vi } from "vitest";

import {
  extractJsonObject,
  extractJsonObjectResult,
} from "@/lib/marketing/bot/organization/envelope";
import {
  buildManagerAgendaSlateFormatRepairPrompt,
  isManagerFormatParseFailure,
  parseManagerAgendaSlateCuration,
  parseManagerAgendaSlateCurationDetailed,
} from "@/lib/marketing/cron/daily/agendaSlate/curateManagerAgendaSlate";
import { runDailyMarketingAgendaSlate } from "@/lib/marketing/cron/daily/runDailyMarketingAgendaSlate";
import {
  createInMemoryDailyMarketingRunRepository,
  resetDefaultDailyMarketingRunRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import {
  createInMemoryDailyAgendaSlateRepository,
  resetDefaultDailyAgendaSlateRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyAgendaSlateRepository";
import {
  agendaCandidate,
  buildResearchContext,
  officialEvidence,
  NOW,
  PRODUCT,
} from "@/lib/marketing/cron/daily/__tests__/fixtures";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import { MarketingBotValidationError } from "@/lib/marketing/bot/errors";

const DAY = "2026-09-05";

function cand(
  n: number,
  partial: Partial<CompactManagerAgendaCandidate> = {},
): CompactManagerAgendaCandidate {
  return {
    ...agendaCandidate,
    agendaCandidateId: `ac-${n}`,
    researchBriefId: `rb-${n}`,
    title: `Outbound topic ${n}`,
    summary: `Summary for outbound topic ${n} with traveler detail.`,
    destinations: partial.destinations ?? [`dest-${n}`],
    topics: partial.topics ?? ["travel"],
    totalResearchScore: 0.5 + n * 0.01,
    koreanOutboundRelevanceScore: partial.koreanOutboundRelevanceScore ?? 0.75,
    scoreReasons: partial.scoreReasons ?? ["koreanOutbound_travelDirection_outbound"],
    evidence: partial.evidence ?? [
      { ...officialEvidence, sourceId: `src-${n}`, sourceName: `Source-${n}` },
    ],
    ...partial,
  };
}

function poolContext(count = 8) {
  const agendaCandidates = Array.from({ length: count }, (_, i) => cand(i + 1));
  return buildResearchContext({
    agendaCandidates,
    briefs: agendaCandidates.map((c) => ({
      researchBriefId: c.researchBriefId,
      title: c.title,
      summary: c.summary,
      destinations: c.destinations,
      topics: c.topics,
      entities: [],
      signalTypes: [],
      publishedAt: null,
      observedAt: NOW.toISOString(),
      freshnessScore: 0.8,
      credibilityScore: 0.8,
      travelRelevanceScore: 0.7,
      publicInterestScore: 0.6,
      corroborationScore: 0.5,
      commercialRelevance: null,
      evidence: c.evidence,
      risks: [],
      openQuestions: [],
      generatedAt: NOW.toISOString(),
      validUntil: null,
    })),
  });
}

function validCurateJson(ids: number[]): string {
  return JSON.stringify({
    decision: "curate",
    items: ids.map((n) => ({
      agendaCandidateId: `ac-${n}`,
      researchBriefId: `rb-${n}`,
      rationale: [`pick ${n}`],
      recommendedFormats: ["threads_text"],
      recommendedChannel: "threads",
    })),
    managerMessage: null,
  });
}

describe("STEP R-6 JSON extraction", () => {
  it("1. bare valid JSON parses", () => {
    const raw = validCurateJson([1, 2, 3, 4, 5, 6]);
    const result = extractJsonObjectResult(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mode).toBe("whole_json");
  });

  it("2. ```json fenced valid JSON parses", () => {
    const raw = "```json\n" + validCurateJson([1, 2, 3, 4, 5, 6]) + "\n```";
    const result = extractJsonObjectResult(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mode).toBe("fenced_json");
    const parsed = parseManagerAgendaSlateCuration(raw, poolContext(), 6);
    expect(parsed.outcome).toBe("curated");
  });

  it("3. plain fenced valid JSON parses", () => {
    const raw = "```\n" + validCurateJson([1, 2, 3, 4, 5, 6]) + "\n```";
    const result = extractJsonObjectResult(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mode).toBe("fenced_json");
  });

  it("4. short prose around one valid JSON object parses", () => {
    const raw = "Here is the slate:\n" + validCurateJson([1, 2, 3, 4, 5, 6]) + "\nThanks.";
    const result = extractJsonObjectResult(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mode).toBe("balanced_object");
    expect(parseManagerAgendaSlateCuration(raw, poolContext(), 6).outcome).toBe("curated");
  });

  it("5. malformed JSON does not get silently invented/repaired locally", () => {
    const raw = '{"decision":"curate","items":[{broken';
    const result = extractJsonObjectResult(raw);
    expect(result.ok).toBe(false);
    expect(() => extractJsonObject(raw)).toThrow(MarketingBotValidationError);
    expect(parseManagerAgendaSlateCuration(raw, poolContext(), 6).message).toBe(
      "manager_slate_json_parse_failed",
    );
  });

  it("6. truncated JSON fails", () => {
    const raw = '{"decision":"curate","items":[{"agendaCandidateId":"ac-1"';
    const result = extractJsonObjectResult(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failureClass).toBe("truncated_json");
  });

  it("7. ambiguous multiple JSON objects fail safely", () => {
    const raw = validCurateJson([1, 2, 3, 4, 5, 6]) + "\n" + '{"decision":"defer_all"}';
    const result = extractJsonObjectResult(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failureClass).toBe("multiple_json_objects");
  });
});

describe("STEP R-6 format retry + boundaries", () => {
  it("8. first format failure + valid correction retry succeeds", async () => {
    resetDefaultDailyMarketingRunRepository();
    resetDefaultDailyAgendaSlateRepository();
    const invoke = vi
      .fn()
      .mockResolvedValueOnce("Sorry, here is broken {not json")
      .mockResolvedValueOnce(validCurateJson([1, 2, 3, 4, 5, 6]));

    const result = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: DAY },
      {
        repo: createInMemoryDailyMarketingRunRepository(),
        slateRepo: createInMemoryDailyAgendaSlateRepository(),
        now: NOW,
        getResearchContext: async () => poolContext(8),
        invokeManagerProfile: invoke,
      },
    );

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(result.slate?.curation.mode).toBe("manager_curated");
    const diag = result.slate?.metadata.managerCuration as {
      managerAttemptCount: number;
      formatRetryUsed: boolean;
      finalParseMode: string;
      firstAttemptFailureClass: string;
    };
    expect(diag.managerAttemptCount).toBe(2);
    expect(diag.formatRetryUsed).toBe(true);
    expect(diag.finalParseMode).toBe("format_retry");
    expect(diag.firstAttemptFailureClass).toBeTruthy();
    expect(buildManagerAgendaSlateFormatRepairPrompt(poolContext(), 6)).toContain("INVALID JSON");
  });

  it("9. second format failure -> fallback", async () => {
    resetDefaultDailyMarketingRunRepository();
    resetDefaultDailyAgendaSlateRepository();
    const invoke = vi
      .fn()
      .mockResolvedValueOnce("not json at all")
      .mockResolvedValueOnce("still not json {{{");

    const result = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: DAY },
      {
        repo: createInMemoryDailyMarketingRunRepository(),
        slateRepo: createInMemoryDailyAgendaSlateRepository(),
        now: NOW,
        getResearchContext: async () => poolContext(8),
        invokeManagerProfile: invoke,
      },
    );

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(result.slate?.curation.mode).toBe("deterministic_fallback");
    const diag = result.slate?.metadata.managerCuration as {
      finalParseMode: string;
      formatRetryUsed: boolean;
    };
    expect(diag.finalParseMode).toBe("fallback");
    expect(diag.formatRetryUsed).toBe(true);
  });

  it("10. timeout does NOT trigger format retry", async () => {
    resetDefaultDailyMarketingRunRepository();
    resetDefaultDailyAgendaSlateRepository();
    const invoke = vi.fn().mockRejectedValue(new Error("marketing-manager timed out after 180000ms"));

    const result = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: DAY },
      {
        repo: createInMemoryDailyMarketingRunRepository(),
        slateRepo: createInMemoryDailyAgendaSlateRepository(),
        now: NOW,
        getResearchContext: async () => poolContext(8),
        invokeManagerProfile: invoke,
      },
    );

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(result.slate?.curation.mode).toBe("deterministic_fallback");
    expect(result.slate?.curation.managerMessage).toContain("timed out");
    const diag = result.slate?.metadata.managerCuration as { formatRetryUsed: boolean };
    expect(diag.formatRetryUsed).toBe(false);
  });

  it("11. fabricated candidate ID does NOT trigger format retry", async () => {
    resetDefaultDailyMarketingRunRepository();
    resetDefaultDailyAgendaSlateRepository();
    const fabricated = JSON.stringify({
      decision: "curate",
      items: Array.from({ length: 6 }, (_, i) => ({
        agendaCandidateId: `fabricated-${i}`,
        researchBriefId: `fabricated-rb-${i}`,
        title: `Fake ${i}`,
        summary: `Fake summary ${i}`,
        rationale: ["x"],
      })),
    });
    const invoke = vi.fn().mockResolvedValue(fabricated);

    const result = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: DAY },
      {
        repo: createInMemoryDailyMarketingRunRepository(),
        slateRepo: createInMemoryDailyAgendaSlateRepository(),
        now: NOW,
        getResearchContext: async () => poolContext(8),
        invokeManagerProfile: invoke,
      },
    );

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(result.slate?.curation.mode).toBe("deterministic_fallback");
    expect(result.slate?.curation.managerMessage).toContain("manager_slate_too_small");
    expect(isManagerFormatParseFailure(parseManagerAgendaSlateCuration(fabricated, poolContext(), 6))).toBe(
      false,
    );
  });

  it("12–13. valid manager selection reaches R-5 diversity repair", async () => {
    resetDefaultDailyMarketingRunRepository();
    resetDefaultDailyAgendaSlateRepository();
    const research = buildResearchContext({
      agendaCandidates: [
        cand(1, {
          destinations: ["Vietnam"],
          evidence: [{ ...officialEvidence, sourceName: "Vietnam Tourism", sourceId: "vn" }],
          koreanOutboundRelevanceScore: 0.9,
        }),
        cand(2, {
          destinations: ["Vietnam"],
          evidence: [{ ...officialEvidence, sourceName: "Vietnam Tourism", sourceId: "vn" }],
          koreanOutboundRelevanceScore: 0.88,
        }),
        cand(3, {
          destinations: ["Vietnam"],
          evidence: [{ ...officialEvidence, sourceName: "Vietnam Tourism", sourceId: "vn" }],
          koreanOutboundRelevanceScore: 0.86,
        }),
        cand(4, {
          destinations: ["Japan"],
          evidence: [{ ...officialEvidence, sourceName: "Traveltimes", sourceId: "tt" }],
          koreanOutboundRelevanceScore: 0.8,
        }),
        cand(5, {
          destinations: ["Thailand"],
          evidence: [{ ...officialEvidence, sourceName: "Travie", sourceId: "tv" }],
          koreanOutboundRelevanceScore: 0.78,
        }),
        cand(6, {
          destinations: ["Australia"],
          evidence: [{ ...officialEvidence, sourceName: "TravelDaily", sourceId: "td" }],
          koreanOutboundRelevanceScore: 0.76,
        }),
      ],
    });

    const result = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: DAY },
      {
        repo: createInMemoryDailyMarketingRunRepository(),
        slateRepo: createInMemoryDailyAgendaSlateRepository(),
        now: NOW,
        getResearchContext: async () => research,
        invokeManagerProfile: async () => validCurateJson([1, 2, 3, 4, 5, 6]),
      },
    );

    expect(result.slate?.curation.mode).toBe("manager_curated");
    const repair = result.slate?.metadata.diversityRepair as {
      repairedSelectionCount: number;
      retainedManagerSelectionCount: number;
    };
    expect(repair.repairedSelectionCount).toBeGreaterThanOrEqual(1);
    expect(repair.retainedManagerSelectionCount).toBeGreaterThanOrEqual(2);
    const origins = result.slate?.metadata.selectionOrigins as Record<string, string>;
    expect(Object.values(origins).some((o) => o === "manager_diversity_repair")).toBe(true);
  });

  it("detailed parse reports extract mode for fenced input", () => {
    const detailed = parseManagerAgendaSlateCurationDetailed(
      "```json\n" + validCurateJson([1, 2, 3, 4, 5, 6]) + "\n```",
      poolContext(),
      6,
    );
    expect(detailed.result.outcome).toBe("curated");
    expect(detailed.diagnostics.extractMode).toBe("fenced_json");
    expect(detailed.diagnostics.validatedItemCount).toBe(6);
  });
});
