vi.mock("server-only", () => ({}));

/**
 * Backward replay safety: OLD truncated sa_/ca_ IDs vs NEW hashed IDs.
 * Daily pipeline uniqueness is logicalRunKey — not generated display IDs.
 */
import { describe, expect, it } from "vitest";

import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { buildStablePrefixedId } from "@/lib/marketing/content/stablePrefixedId";
import { runDailyMarketingPipeline } from "@/lib/marketing/cron/daily/runDailyMarketingPipeline";
import {
  createInMemoryDailyMarketingRunRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { createInMemoryGovernanceReviewStore } from "@/lib/marketing/content/governance/store/governanceReviewStore";
import { createInMemoryHumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import {
  buildResearchContext,
  managerSelectJson,
  NOW,
  PRODUCT,
} from "@/lib/marketing/cron/daily/__tests__/fixtures";
import type { ContentStrategistOutput, GovernanceReviewResult } from "@/lib/marketing/bot/organization/handoffs";
import type { CompletedMarketingCandidate, DailyMarketingRun } from "@/lib/marketing/cron/daily/types";
import { DAILY_MARKETING_RUN_CONTRACT, DAILY_MARKETING_ROUTINE_ID } from "@/lib/marketing/cron/daily/types";

const LOGICAL_KEY = "daily-marketing-plan:2026-09-04";
const BUSINESS_DATE = "2026-09-04";

/** Pre-hardening ID algorithm: truncate raw logical key. */
function legacyPrefixedId(prefix: "sa" | "ca", logicalKey: string): string {
  return `${prefix}_${logicalKey.slice(0, 24)}`;
}

describe("stable ID backward replay safety", () => {
  it("legacy truncated IDs collide across dates; hashed IDs do not", () => {
    const keyA = "daily-marketing-plan:2026-09-03";
    const keyB = "daily-marketing-plan:2026-09-04";
    expect(legacyPrefixedId("sa", keyA)).toBe(legacyPrefixedId("sa", keyB));
    expect(buildStablePrefixedId("sa", keyA)).not.toBe(buildStablePrefixedId("sa", keyB));
  });

  it("handoff store keyed by full logicalRunKey returns historical OLD ids on replay", () => {
    const store = createInMemoryContentAssignmentStore();
    const oldAgendaId = legacyPrefixedId("sa", LOGICAL_KEY);
    const oldAssignmentId = legacyPrefixedId("ca", LOGICAL_KEY);

    const seeded = prepareManagerToContentHandoff(
      {
        title: "Historical",
        summary: "Historical summary.",
        idempotencyKey: `${LOGICAL_KEY}:seed-only`,
        now: NOW,
      },
      { store: createInMemoryContentAssignmentStore(), now: NOW },
    );

    store.save({
      selectedAgenda: { ...seeded.selectedAgenda, id: oldAgendaId },
      assignment: {
        ...seeded.contentAssignment,
        assignmentId: oldAssignmentId,
        selectedAgendaId: oldAgendaId,
        provenance: {
          ...seeded.contentAssignment.provenance,
          selectedAgendaId: oldAgendaId,
          idempotencyKey: LOGICAL_KEY,
        },
      },
      idempotencyKey: LOGICAL_KEY,
    });

    const replay = prepareManagerToContentHandoff(
      {
        title: "Would-be-new",
        summary: "Would create hashed ids if not idempotent.",
        idempotencyKey: LOGICAL_KEY,
        now: NOW,
      },
      { store, now: NOW },
    );

    expect(buildStablePrefixedId("sa", LOGICAL_KEY)).not.toBe(oldAgendaId);
    expect(replay.selectedAgenda.id).toBe(oldAgendaId);
    expect(replay.contentAssignment.assignmentId).toBe(oldAssignmentId);
  });

  it("daily pipeline: historical OLD-style candidate + NEW code rerun → skipped_idempotent, no duplicate", async () => {
    const repo = createInMemoryDailyMarketingRunRepository();
    const oldAgendaId = legacyPrefixedId("sa", LOGICAL_KEY);
    const oldAssignmentId = legacyPrefixedId("ca", LOGICAL_KEY);

    const handoff = prepareManagerToContentHandoff(
      {
        title: "Japan autumn travel update",
        summary: "Official guidance changed for autumn travelers.",
        agendaCandidateId: "ac-japan-autumn",
        researchBriefId: "rb-japan-autumn",
        idempotencyKey: LOGICAL_KEY,
        now: NOW,
      },
      { store: createInMemoryContentAssignmentStore(), now: NOW },
    );

    const historicalCandidate: CompletedMarketingCandidate = {
      contract: "completed-marketing-candidate-v1",
      candidateId: "cmc_daily_marketing_plan_2026_09_04",
      runId: "run-historical-0904",
      logicalRunKey: LOGICAL_KEY,
      businessDateKst: BUSINESS_DATE,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      selectedAgenda: { ...handoff.selectedAgenda, id: oldAgendaId },
      contentAssignment: {
        ...handoff.contentAssignment,
        assignmentId: oldAssignmentId,
        selectedAgendaId: oldAgendaId,
      },
      contentPlan: handoff.contentPlanScaffold,
      draft: {
        title: "Japan autumn update",
        body: "Official guidance changed for autumn travelers.",
        channel: "threads",
        agenda: "Japan autumn travel update",
        sourceReferences: ["evidence:ev-official"],
      },
      governanceDecision: null,
      status: "ready_for_human_review",
      revisionHistory: [],
      provenance: {
        routineId: DAILY_MARKETING_ROUTINE_ID,
        correlationId: "corr-historical",
        researchStatus: "ok",
        governanceReviewId: null,
      },
      observability: {
        runId: "run-historical-0904",
        logicalRunKey: LOGICAL_KEY,
        businessDateKst: BUSINESS_DATE,
        correlationId: "corr-historical",
        researchStatus: "ok",
        candidateCount: 1,
        selectedAgendaId: oldAgendaId,
        assignmentId: oldAssignmentId,
        governanceReviewId: null,
        revisionCount: 0,
        governanceDecision: "ALLOW",
        finalCandidateId: "cmc_daily_marketing_plan_2026_09_04",
        finalStatus: "ready_for_human_review",
        startedAt: NOW.toISOString(),
        completedAt: NOW.toISOString(),
        failureReason: null,
      },
    };

    const historicalRun: DailyMarketingRun = {
      contract: DAILY_MARKETING_RUN_CONTRACT,
      runId: "run-historical-0904",
      logicalRunKey: LOGICAL_KEY,
      businessDateKst: BUSINESS_DATE,
      routineId: DAILY_MARKETING_ROUTINE_ID,
      correlationId: "corr-historical",
      executionAttempt: 1,
      startedAt: NOW.toISOString(),
      completedAt: NOW.toISOString(),
      status: "completed",
      researchStatus: "ok",
      selectedAgendaId: oldAgendaId,
      assignmentId: oldAssignmentId,
      governanceReviewId: null,
      completedCandidateId: historicalCandidate.candidateId,
      failureReason: null,
      degraded: false,
      observability: historicalCandidate.observability,
      metadata: { finalStatus: historicalCandidate.status },
    };

    await repo.saveRun(historicalRun);
    await repo.saveCandidate(historicalCandidate);

    const draft: ContentStrategistOutput = {
      title: "Japan autumn update",
      body: "Official guidance changed for autumn travelers.",
      channel: "threads",
      agenda: "Japan autumn travel update",
      sourceReferences: ["evidence:ev-official"],
    };
    const allow = (): GovernanceReviewResult => ({
      decision: "ALLOW",
      riskScore: 0,
      reasons: ["NO_RISK_SIGNAL"],
      revisionHints: [],
      humanApprovalRequired: false,
      semanticAvailable: true,
    });

    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      {
        repo,
        reviewRepo: createInMemoryHumanMarketingReviewRepository(),
        now: NOW,
        contentAssignmentStore: createInMemoryContentAssignmentStore(),
        governanceReviewStore: createInMemoryGovernanceReviewStore(),
        getResearchContext: async () => buildResearchContext(),
        invokeManagerProfile: async () => managerSelectJson(),
        requestDraft: async () => draft,
        requestGovernance: async () => allow(),
        requestPerformance: async () => ({ unavailable: true as const, reason: "test" }),
      },
    );

    expect(result.idempotent).toBe(true);
    expect(result.run.status).toBe("skipped_idempotent");
    expect(result.candidate?.candidateId).toBe(historicalCandidate.candidateId);
    expect(result.candidate?.selectedAgenda.id).toBe(oldAgendaId);
    expect(result.candidate?.contentAssignment.assignmentId).toBe(oldAssignmentId);
    // Hashed NEW ids differ — but must not create a second logical candidate.
    expect(buildStablePrefixedId("sa", LOGICAL_KEY)).not.toBe(oldAgendaId);
    const listed = await repo.listCandidates({ businessDateKst: BUSINESS_DATE, limit: 10 });
    expect(listed).toHaveLength(1);
  });
});
