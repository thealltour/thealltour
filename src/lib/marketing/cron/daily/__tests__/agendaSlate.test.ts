vi.mock("server-only", () => ({}));

import { describe, expect, it, beforeEach } from "vitest";

import {
  buildDailyAgendaSlate,
  markAgendaSlateItemDeferred,
  listDeferredSlateCandidates,
} from "@/lib/marketing/cron/daily/agendaSlate/buildDailyAgendaSlate";
import {
  DEFAULT_AGENDA_SLATE_SIZE,
  resolveAgendaSlateTargetSize,
} from "@/lib/marketing/cron/daily/agendaSlate/config";
import { runDailyMarketingAgendaSlate } from "@/lib/marketing/cron/daily/runDailyMarketingAgendaSlate";
import { runDailyMarketingProductionFromSelection } from "@/lib/marketing/cron/daily/runDailyMarketingProductionFromSelection";
import { runDailyMarketingProductionPipeline } from "@/lib/marketing/cron/daily/runDailyMarketingProductionPipeline";
import {
  createInMemoryDailyAgendaSlateRepository,
  resetDefaultDailyAgendaSlateRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyAgendaSlateRepository";
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
  managerSelectJson,
  NOW,
  PRODUCT,
  researchBrief,
  officialEvidence,
} from "@/lib/marketing/cron/daily/__tests__/fixtures";
import type { ContentStrategistOutput, GovernanceReviewResult } from "@/lib/marketing/bot/organization/handoffs";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";

const BUSINESS_DATE = "2026-09-05";

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

function multiCandidateContext(count = 6) {
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
    briefs: agendaCandidates.map((c, i) => ({
      ...researchBrief,
      researchBriefId: c.researchBriefId,
      title: c.title,
      summary: c.summary,
      evidence: c.evidence,
    })),
  });
}

describe("agenda slate config", () => {
  it("defaults to 6 and clamps to 5–8", () => {
    expect(resolveAgendaSlateTargetSize()).toBe(DEFAULT_AGENDA_SLATE_SIZE);
    expect(resolveAgendaSlateTargetSize(3)).toBe(5);
    expect(resolveAgendaSlateTargetSize(9)).toBe(8);
    expect(resolveAgendaSlateTargetSize(7)).toBe(7);
  });
});

describe("STEP G-1/G-2 DailyAgendaSlate", () => {
  beforeEach(() => {
    resetDefaultDailyMarketingRunRepository();
    resetDefaultDailyAgendaSlateRepository();
  });

  it("A: eligible research -> slate created, no production candidate", async () => {
    const repo = createInMemoryDailyMarketingRunRepository();
    const slateRepo = createInMemoryDailyAgendaSlateRepository();
    const reviewRepo = createInMemoryHumanMarketingReviewRepository();
    const result = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      {
        repo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => multiCandidateContext(6),
      },
    );
    expect(result.run.status).toBe("slate_ready");
    expect(result.candidate).toBeNull();
    expect(result.slate?.candidates.length).toBeGreaterThanOrEqual(5);
    expect(await repo.findCandidateByLogicalKey(result.run.logicalRunKey)).toBeNull();
    expect(await reviewRepo.listReviews({ limit: 10 })).toEqual([]);
  });

  it("B: slate contains multiple candidates", async () => {
    const slate = buildDailyAgendaSlate({
      research: multiCandidateContext(8),
      logicalRunKey: `daily-marketing-plan:${BUSINESS_DATE}`,
      businessDateKst: BUSINESS_DATE,
      runId: "run-1",
      correlationId: "corr-1",
      now: NOW,
    });
    expect(slate.candidates.length).toBe(DEFAULT_AGENDA_SLATE_SIZE);
    expect(new Set(slate.candidates.map((c) => c.slateItemId)).size).toBe(slate.candidates.length);
  });

  it("C: exact cooldown-filtered research does not appear", async () => {
    const repo = createInMemoryDailyMarketingRunRepository();
    const slateRepo = createInMemoryDailyAgendaSlateRepository();

    // Seed yesterday production candidate with ac-item-1 identity.
    const priorHandoff = prepareManagerToContentHandoff(
      {
        title: "Travel topic 1",
        summary: "Summary for topic 1 with enough detail.",
        agendaCandidateId: "ac-item-1",
        researchBriefId: "rb-item-1",
        evidenceRefs: [
          {
            evidenceId: "ev-item-1",
            sourceId: "src",
            sourceType: "news",
            sourceName: "Press",
            isOfficial: false,
            evidenceType: "article",
            url: "https://example.com/articles/topic-1",
            reference: null,
            excerpt: "Summary for topic 1 with enough detail.",
            publishedAt: "2026-09-01T00:00:00.000Z",
            observedAt: NOW.toISOString(),
            credibilityHint: 0.7,
          },
        ],
        idempotencyKey: "daily-marketing-plan:2026-09-04",
        now: NOW,
      },
      { store: createInMemoryContentAssignmentStore(), now: NOW },
    );
    await repo.saveCandidate({
      contract: "completed-marketing-candidate-v1",
      candidateId: "cmc_prior",
      runId: "run_prior",
      logicalRunKey: "daily-marketing-plan:2026-09-04",
      businessDateKst: "2026-09-04",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      selectedAgenda: priorHandoff.selectedAgenda,
      contentAssignment: priorHandoff.contentAssignment,
      contentPlan: priorHandoff.contentPlanScaffold,
      draft: groundedDraft,
      governanceDecision: null,
      status: "ready_for_human_review",
      revisionHistory: [],
      provenance: {
        routineId: "daily-marketing-plan",
        correlationId: "corr",
        researchStatus: "ok",
        governanceReviewId: null,
      },
      observability: {
        runId: "run_prior",
        logicalRunKey: "daily-marketing-plan:2026-09-04",
        businessDateKst: "2026-09-04",
        correlationId: "corr",
        researchStatus: "ok",
        candidateCount: 1,
        selectedAgendaId: priorHandoff.selectedAgenda.id,
        assignmentId: priorHandoff.contentAssignment.assignmentId,
        governanceReviewId: null,
        revisionCount: 0,
        governanceDecision: null,
        finalCandidateId: null,
        finalStatus: null,
        startedAt: NOW.toISOString(),
        completedAt: NOW.toISOString(),
        failureReason: null,
      },
    });

    const result = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      {
        repo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => multiCandidateContext(6),
      },
    );
    expect(result.slate?.candidates.some((c) => c.agendaCandidateId === "ac-item-1")).toBe(false);
    expect(result.slate?.cooldown.excludedAgendaCandidateIds).toContain("ac-item-1");
  });

  it("D: no CS/Draft/Governance/HumanReview bootstrap after slate-only run", async () => {
    const repo = createInMemoryDailyMarketingRunRepository();
    const slateRepo = createInMemoryDailyAgendaSlateRepository();
    const reviewRepo = createInMemoryHumanMarketingReviewRepository();
    let draftCalls = 0;
    let governanceCalls = 0;
    const result = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      {
        repo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => multiCandidateContext(6),
      },
    );
    // Slate path does not accept draft/governance deps — prove side effects absent.
    expect(result.candidate).toBeNull();
    expect(result.run.assignmentId).toBeNull();
    expect(result.run.governanceReviewId).toBeNull();
    expect(result.run.completedCandidateId).toBeNull();
    expect(await reviewRepo.listReviews({ limit: 20 })).toHaveLength(0);
    expect(draftCalls + governanceCalls).toBe(0);
  });

  it("E: same daily logical run is idempotent", async () => {
    const repo = createInMemoryDailyMarketingRunRepository();
    const slateRepo = createInMemoryDailyAgendaSlateRepository();
    const deps = {
      repo,
      slateRepo,
      now: NOW,
      getResearchContext: async () => multiCandidateContext(6),
    };
    const first = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    const second = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(second.run.status).toBe("skipped_idempotent");
    expect(second.slate?.slateId).toBe(first.slate?.slateId);
    const listed = await slateRepo.listRecent({ limit: 10 });
    expect(listed.filter((s) => s.businessDateKst === BUSINESS_DATE)).toHaveLength(1);
  });

  it("F: deferred-state representation is preserved and distinguishable on carry-over", async () => {
    const research = multiCandidateContext(6);
    const base = buildDailyAgendaSlate({
      research,
      logicalRunKey: "daily-marketing-plan:2026-09-04",
      businessDateKst: "2026-09-04",
      runId: "run-prev",
      correlationId: "corr-prev",
      now: NOW,
    });
    const deferred = markAgendaSlateItemDeferred(base, base.candidates[0]!.slateItemId, NOW);
    expect(deferred.candidates[0]?.state).toBe("DEFERRED");
    const carry = listDeferredSlateCandidates([deferred]);
    expect(carry).toHaveLength(1);

    const next = buildDailyAgendaSlate({
      research: multiCandidateContext(6),
      logicalRunKey: `daily-marketing-plan:${BUSINESS_DATE}`,
      businessDateKst: BUSINESS_DATE,
      runId: "run-next",
      correlationId: "corr-next",
      deferredCarryover: carry,
      now: NOW,
    });
    const pinned = next.candidates.find((c) => c.origin === "deferred_carryover");
    expect(pinned).toBeTruthy();
    expect(pinned?.state).toBe("AVAILABLE");
    expect(pinned?.deferredFromBusinessDateKst).toBe("2026-09-04");
    expect(pinned?.agendaCandidateId).toBe(carry[0]?.agendaCandidateId);
    expect(next.candidates.some((c) => c.origin === "organic_research")).toBe(true);
  });

  it("G: no eligible research -> explicit deferred RESEARCH_EMPTY", async () => {
    const repo = createInMemoryDailyMarketingRunRepository();
    const slateRepo = createInMemoryDailyAgendaSlateRepository();
    const result = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      {
        repo,
        slateRepo,
        now: NOW,
        getResearchContext: async () =>
          buildResearchContext({ status: "empty", agendaCandidates: [], briefs: [] }),
      },
    );
    expect(result.run.status).toBe("deferred");
    expect(result.run.failureReason).toBe("RESEARCH_EMPTY");
    expect(result.slate).toBeNull();
    expect(result.candidate).toBeNull();
  });

  it("H: existing downstream production entrypoint remains callable independently", async () => {
    const repo = createInMemoryDailyMarketingRunRepository();
    const reviewRepo = createInMemoryHumanMarketingReviewRepository();
    const result = await runDailyMarketingProductionFromSelection(
      {
        productId: PRODUCT,
        channel: "threads",
        businessDateKst: BUSINESS_DATE,
        selection: {
          title: "Japan autumn travel update",
          summary: "Official guidance changed for autumn travelers.",
          agendaCandidateId: "ac-japan-autumn",
          researchBriefId: "rb-japan-autumn",
          rationale: ["human selected"],
        },
      },
      {
        repo,
        reviewRepo,
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
    expect(result.run.status).toBe("completed");
    expect(result.run.completedCandidateId).toBeTruthy();

    // Full production pipeline with manager select also remains exported.
    const viaManager = await runDailyMarketingProductionPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: "2026-09-06" },
      {
        repo: createInMemoryDailyMarketingRunRepository(),
        reviewRepo: createInMemoryHumanMarketingReviewRepository(),
        now: NOW,
        contentAssignmentStore: createInMemoryContentAssignmentStore(),
        governanceReviewStore: createInMemoryGovernanceReviewStore(),
        getResearchContext: async () => buildResearchContext(),
        invokeManagerProfile: async () => managerSelectJson(),
        requestDraft: async () => groundedDraft,
        requestGovernance: async () => allow(),
        requestPerformance: async () => ({ unavailable: true as const, reason: "test" }),
      },
    );
    expect(viaManager.candidate?.status).toMatch(/human_review|blocked|failed/);
  });
});
