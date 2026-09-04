vi.mock("server-only", () => ({}));

import { describe, expect, it, beforeEach } from "vitest";

import {
  applyAgendaSlateAction,
  AgendaSlateActionError,
} from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateActions";
import {
  buildDailyAgendaSlate,
  listDeferredFromPreviousDaySlate,
  markAgendaSlateItemDeferred,
} from "@/lib/marketing/cron/daily/agendaSlate/buildDailyAgendaSlate";
import {
  buildManagerAgendaSlateCurationPrompt,
  parseManagerAgendaSlateCuration,
} from "@/lib/marketing/cron/daily/agendaSlate/curateManagerAgendaSlate";
import { buildProductionLogicalRunKey } from "@/lib/marketing/cron/daily/agendaSlate/productionLogicalRunKey";
import { createAgendaSlateService } from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateService";
import { runDailyMarketingAgendaSlate } from "@/lib/marketing/cron/daily/runDailyMarketingAgendaSlate";
import { runDailyMarketingProductionFromSelection } from "@/lib/marketing/cron/daily/runDailyMarketingProductionFromSelection";
import {
  createInMemoryDailyAgendaSlateRepository,
  resetDefaultDailyAgendaSlateRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyAgendaSlateRepository";
import {
  createInMemoryMarketingProductionRequestRepository,
  resetDefaultMarketingProductionRequestRepository,
} from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import {
  createInMemoryDailyMarketingRunRepository,
  resetDefaultDailyMarketingRunRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import { createInMemoryGovernanceReviewStore } from "@/lib/marketing/content/governance/store/governanceReviewStore";
import { createInMemoryHumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import {
  agendaCandidate,
  buildResearchContext,
  NOW,
  PRODUCT,
  researchBrief,
  officialEvidence,
} from "@/lib/marketing/cron/daily/__tests__/fixtures";
import type { ContentStrategistOutput, GovernanceReviewResult } from "@/lib/marketing/bot/organization/handoffs";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import { subtractKstBusinessDays } from "@/lib/marketing/cron/daily/researchIdentityCooldown";

const DAY = "2026-09-05";
const PREV = "2026-09-04";

function allow(): GovernanceReviewResult {
  return {
    decision: "ALLOW",
    riskScore: 0,
    reasons: ["NO_RISK_SIGNAL"],
    revisionHints: [],
    humanApprovalRequired: false,
    semanticAvailable: true,
  };
}

const groundedDraft: ContentStrategistOutput = {
  title: "Japan autumn update",
  body: "Official guidance changed for autumn travelers.",
  channel: "threads",
  agenda: "Japan autumn travel update",
  sourceReferences: ["evidence:ev-official"],
};

function multiCandidateContext(count = 8) {
  const agendaCandidates: CompactManagerAgendaCandidate[] = Array.from({ length: count }, (_, i) => ({
    ...agendaCandidate,
    agendaCandidateId: `ac-item-${i + 1}`,
    researchBriefId: `rb-item-${i + 1}`,
    title: `Travel topic ${i + 1}`,
    summary: `Summary for topic ${i + 1} with enough detail.`,
    totalResearchScore: 0.9 - i * 0.05,
    evidence: [
      {
        ...officialEvidence,
        evidenceId: `ev-item-${i + 1}`,
        url: `https://example.com/articles/topic-${i + 1}`,
        excerpt: `Summary for topic ${i + 1} with enough detail.`,
      },
    ],
  }));
  return buildResearchContext({
    agendaCandidates,
    briefs: agendaCandidates.map((c) => ({
      ...researchBrief,
      researchBriefId: c.researchBriefId,
      title: c.title,
      summary: c.summary,
      evidence: c.evidence,
    })),
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

describe("STEP G-3/G-4/G-5/G-6 agenda slate curation & human gates", () => {
  beforeEach(() => {
    resetDefaultDailyMarketingRunRepository();
    resetDefaultDailyAgendaSlateRepository();
    resetDefaultMarketingProductionRequestRepository();
  });

  it("1: MM returns multiple curated candidates", async () => {
    const research = multiCandidateContext(8);
    const parsed = parseManagerAgendaSlateCuration(managerCurateJson([2, 4, 6, 8, 1, 3]), research, 6);
    expect(parsed.outcome).toBe("curated");
    if (parsed.outcome !== "curated") return;
    expect(parsed.items.length).toBe(6);
    expect(parsed.items.map((i) => i.agendaCandidateId)).toEqual([
      "ac-item-2",
      "ac-item-4",
      "ac-item-6",
      "ac-item-8",
      "ac-item-1",
      "ac-item-3",
    ]);
    expect(buildManagerAgendaSlateCurationPrompt(research)).toContain("CURATING");

    const repo = createInMemoryDailyMarketingRunRepository();
    const slateRepo = createInMemoryDailyAgendaSlateRepository();
    const result = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: DAY },
      {
        repo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => research,
        invokeManagerProfile: async () => managerCurateJson([2, 4, 6, 8, 1, 3]),
      },
    );
    expect(result.slate?.curation.mode).toBe("manager_curated");
    expect(result.slate?.candidates[0]?.agendaCandidateId).toBe("ac-item-2");
    expect(result.slate?.candidates[0]?.editorial.freshnessWhyNow).toContain("Fresh");
    expect(result.slate?.candidates[0]?.rationale[0]).toContain("MM pick");
  });

  it("2: slate-only run still creates NO production candidate/HMR", async () => {
    const repo = createInMemoryDailyMarketingRunRepository();
    const slateRepo = createInMemoryDailyAgendaSlateRepository();
    const reviewRepo = createInMemoryHumanMarketingReviewRepository();
    const result = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: DAY },
      {
        repo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => multiCandidateContext(6),
        invokeManagerProfile: async () => managerCurateJson([1, 2, 3, 4, 5, 6]),
      },
    );
    expect(result.candidate).toBeNull();
    expect(await repo.findCandidateByLogicalKey(result.run.logicalRunKey)).toBeNull();
    expect(await reviewRepo.listReviews({ limit: 10 })).toEqual([]);
  });

  it("3-5: select 1/2/3 ok, 4th rejected, selection does not execute production", async () => {
    const slateRepo = createInMemoryDailyAgendaSlateRepository();
    const productionRequestRepo = createInMemoryMarketingProductionRequestRepository();
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const slateResult = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: DAY },
      {
        repo: runRepo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => multiCandidateContext(6),
      },
    );
    const service = await createAgendaSlateService({
      slateRepo,
      productionRequestRepo,
      now: NOW,
    });

    const ids = slateResult.slate!.candidates.slice(0, 4).map((c) => c.slateItemId);
    await service.applyAction({ slateItemId: ids[0]!, action: "select_today", businessDateKst: DAY });
    await service.applyAction({ slateItemId: ids[1]!, action: "select_today", businessDateKst: DAY });
    const third = await service.applyAction({
      slateItemId: ids[2]!,
      action: "select_today",
      businessDateKst: DAY,
    });
    expect(third.observability.selectedTodayCount).toBe(3);

    await expect(
      service.applyAction({ slateItemId: ids[3]!, action: "select_today", businessDateKst: DAY }),
    ).rejects.toMatchObject({ code: "MAX_SELECTED" });

    // Selection alone must not create production candidate or queue.
    expect(await productionRequestRepo.listByBusinessDate(DAY)).toHaveLength(0);
    expect(await runRepo.listCandidates({ limit: 10 })).toHaveLength(0);
  });

  it("6-8: batch production request is durable, per-key, idempotent", async () => {
    const slateRepo = createInMemoryDailyAgendaSlateRepository();
    const productionRequestRepo = createInMemoryMarketingProductionRequestRepository();
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const slateResult = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: DAY },
      {
        repo: runRepo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => multiCandidateContext(6),
      },
    );
    const service = await createAgendaSlateService({
      slateRepo,
      productionRequestRepo,
      now: NOW,
    });
    const picks = slateResult.slate!.candidates.slice(0, 3);
    for (const item of picks) {
      await service.applyAction({
        slateItemId: item.slateItemId,
        action: "select_today",
        businessDateKst: DAY,
      });
    }

    const first = await service.requestProductionForSelected({ businessDateKst: DAY });
    expect(first.createdCount).toBe(3);
    expect(first.requests).toHaveLength(3);
    expect(new Set(first.requests.map((r) => r.logicalRunKey)).size).toBe(3);
    for (const req of first.requests) {
      expect(req.status).toBe("QUEUED");
      expect(req.logicalRunKey.startsWith(`daily-marketing-production:${DAY}:`)).toBe(true);
    }
    const keys = picks.map((p) =>
      buildProductionLogicalRunKey({
        businessDateKst: DAY,
        agendaCandidateId: p.agendaCandidateId,
        researchBriefId: p.researchBriefId,
        title: p.title,
        canonicalArticleIds: p.canonicalArticleIds,
      }),
    );
    expect(first.requests.map((r) => r.logicalRunKey).sort()).toEqual([...keys].sort());

    const second = await service.requestProductionForSelected({ businessDateKst: DAY });
    expect(second.createdCount).toBe(0);
    expect(second.requests.map((r) => r.logicalRunKey).sort()).toEqual(
      first.requests.map((r) => r.logicalRunKey).sort(),
    );
    expect(await productionRequestRepo.listByBusinessDate(DAY)).toHaveLength(3);

    // Still no synchronous production execution.
    expect(await runRepo.listCandidates({ limit: 10 })).toHaveLength(0);
  });

  it("9-11: deferred pinned next day, cooldown-exempt, one-day only", async () => {
    const slateRepo = createInMemoryDailyAgendaSlateRepository();
    const runRepo = createInMemoryDailyMarketingRunRepository();

    const day1 = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: PREV },
      {
        repo: runRepo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => multiCandidateContext(6),
      },
    );
    const deferredId = day1.slate!.candidates[0]!.agendaCandidateId;
    const deferredItemId = day1.slate!.candidates[0]!.slateItemId;
    const service = await createAgendaSlateService({ slateRepo, now: NOW });
    await service.applyAction({
      slateItemId: deferredItemId,
      action: "defer",
      businessDateKst: PREV,
    });

    // Even if production cooldown would have excluded this identity, deferred pin wins.
    const cooledResearch = multiCandidateContext(6);
    // Simulate organic cooldown by emptying matching identities from research — deferred still pins.
    const filtered = {
      ...cooledResearch,
      agendaCandidates: cooledResearch.agendaCandidates.filter((c) => c.agendaCandidateId !== deferredId),
    };

    const day2 = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: DAY },
      {
        repo: runRepo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => filtered,
      },
    );
    const pinned = day2.slate!.candidates.find((c) => c.origin === "deferred_carryover");
    expect(pinned?.agendaCandidateId).toBe(deferredId);
    expect(pinned?.deferredFromBusinessDateKst).toBe(PREV);

    // If not deferred again on day2, day3 must NOT auto-carry.
    const day2Slate = await slateRepo.findByBusinessDate(DAY);
    expect(day2Slate?.candidates.some((c) => c.state === "DEFERRED")).toBe(false);
    const prevForDay3 = subtractKstBusinessDays("2026-09-06", 1);
    expect(prevForDay3).toBe(DAY);
    const carryToDay3 = listDeferredFromPreviousDaySlate(day2Slate, DAY);
    expect(carryToDay3).toHaveLength(0);
  });

  it("12-13: rejected exact identity suppressed 7 days; unrelated remains", async () => {
    const slateRepo = createInMemoryDailyAgendaSlateRepository();
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const day1 = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: PREV },
      {
        repo: runRepo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => multiCandidateContext(6),
      },
    );
    const rejected = day1.slate!.candidates[0]!;
    const unrelated = day1.slate!.candidates[1]!;
    const service = await createAgendaSlateService({ slateRepo, now: NOW });
    await service.applyAction({
      slateItemId: rejected.slateItemId,
      action: "reject",
      businessDateKst: PREV,
    });

    const day2 = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: DAY },
      {
        repo: runRepo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => multiCandidateContext(6),
      },
    );
    expect(day2.slate?.candidates.some((c) => c.agendaCandidateId === rejected.agendaCandidateId)).toBe(
      false,
    );
    expect(day2.slate?.candidates.some((c) => c.agendaCandidateId === unrelated.agendaCandidateId)).toBe(
      true,
    );
    expect(day2.slate?.cooldown.rejectedExcludedAgendaCandidateIds).toContain(rejected.agendaCandidateId);
  });

  it("14: existing downstream production executor remains independently callable", async () => {
    const result = await runDailyMarketingProductionFromSelection(
      {
        productId: PRODUCT,
        channel: "threads",
        businessDateKst: DAY,
        selection: {
          title: "Japan autumn travel update",
          summary: "Official guidance changed for autumn travelers.",
          agendaCandidateId: "ac-japan-autumn",
          researchBriefId: "rb-japan-autumn",
          rationale: ["human selected"],
        },
      },
      {
        repo: createInMemoryDailyMarketingRunRepository(),
        reviewRepo: createInMemoryHumanMarketingReviewRepository(),
        now: NOW,
        contentAssignmentStore: createInMemoryContentAssignmentStore(),
        governanceReviewStore: createInMemoryGovernanceReviewStore(),
        getResearchContext: async () => buildResearchContext(),
        requestDraft: async () => groundedDraft,
        requestGovernance: async () => allow(),
        requestPerformance: async () => ({ unavailable: true as const, reason: "test" }),
      },
    );
    expect(result.candidate).toBeTruthy();
    expect(result.run.logicalRunKey.startsWith(`daily-marketing-production:${DAY}:`)).toBe(true);
    expect(result.run.status).toBe("completed");
  });

  it("illegal transition / malformed id / reset available", () => {
    const slate = buildDailyAgendaSlate({
      research: multiCandidateContext(6),
      logicalRunKey: `daily-marketing-plan:${DAY}`,
      businessDateKst: DAY,
      runId: "run",
      correlationId: "corr",
      now: NOW,
    });
    const id = slate.candidates[0]!.slateItemId;
    const selected = applyAgendaSlateAction({
      slate,
      slateItemId: id,
      action: "select_today",
      expectedBusinessDateKst: DAY,
      now: NOW,
    });
    expect(() =>
      applyAgendaSlateAction({
        slate: selected,
        slateItemId: id,
        action: "defer",
        expectedBusinessDateKst: DAY,
        now: NOW,
      }),
    ).toThrow(AgendaSlateActionError);

    const reset = applyAgendaSlateAction({
      slate: selected,
      slateItemId: id,
      action: "reset_available",
      expectedBusinessDateKst: DAY,
      now: NOW,
    });
    expect(reset.candidates[0]?.state).toBe("AVAILABLE");

    expect(() =>
      applyAgendaSlateAction({
        slate,
        slateItemId: "bad-id",
        action: "select_today",
        expectedBusinessDateKst: DAY,
        now: NOW,
      }),
    ).toThrow(/malformed/);
  });

  it("deferred helper preserves provenance for next-day pin", () => {
    const base = buildDailyAgendaSlate({
      research: multiCandidateContext(6),
      logicalRunKey: `daily-marketing-plan:${PREV}`,
      businessDateKst: PREV,
      runId: "run",
      correlationId: "corr",
      now: NOW,
    });
    const deferred = markAgendaSlateItemDeferred(base, base.candidates[0]!.slateItemId, NOW);
    const carry = listDeferredFromPreviousDaySlate(deferred, PREV);
    expect(carry).toHaveLength(1);
    const next = buildDailyAgendaSlate({
      research: multiCandidateContext(6),
      logicalRunKey: `daily-marketing-plan:${DAY}`,
      businessDateKst: DAY,
      runId: "run2",
      correlationId: "corr2",
      deferredCarryover: carry,
      now: NOW,
    });
    expect(next.candidates[0]?.origin).toBe("deferred_carryover");
  });
});
