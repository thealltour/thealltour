vi.mock("server-only", () => ({}));

import { describe, expect, it, beforeEach } from "vitest";

import { createAgendaSlateService } from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateService";
import { buildProductionExecutionInput } from "@/lib/marketing/cron/daily/agendaSlate/processMarketingProductionQueue";
import { runDailyMarketingAgendaSlate } from "@/lib/marketing/cron/daily/runDailyMarketingAgendaSlate";
import {
  createInMemoryDailyAgendaSlateRepository,
  resetDefaultDailyAgendaSlateRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyAgendaSlateRepository";
import {
  createInMemoryMarketingProductionRequestRepository,
  ownershipFromClaim,
  resetDefaultMarketingProductionRequestRepository,
} from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import {
  createInMemoryDailyMarketingRunRepository,
  resetDefaultDailyMarketingRunRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import {
  agendaCandidate,
  buildResearchContext,
  NOW,
  PRODUCT,
  researchBrief,
  officialEvidence,
} from "@/lib/marketing/cron/daily/__tests__/fixtures";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";

const DAY = "2026-09-05";

function multiCandidateContext(count = 4) {
  const agendaCandidates: CompactManagerAgendaCandidate[] = Array.from({ length: count }, (_, i) => ({
    ...agendaCandidate,
    agendaCandidateId: `ac-retry-${i + 1}`,
    researchBriefId: `rb-retry-${i + 1}`,
    title: `Retry topic ${i + 1}`,
    summary: `Summary for retry topic ${i + 1} with enough detail.`,
    totalResearchScore: 0.9 - i * 0.05,
    evidence: [
      {
        ...officialEvidence,
        evidenceId: `ev-retry-${i + 1}`,
        url: `https://example.com/articles/retry-${i + 1}`,
        excerpt: `Summary for retry topic ${i + 1} with enough detail.`,
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

describe("agenda slate retry + terminal selection reconcile", () => {
  beforeEach(() => {
    resetDefaultDailyAgendaSlateRepository();
    resetDefaultMarketingProductionRequestRepository();
    resetDefaultDailyMarketingRunRepository();
  });

  it("requeues FAILED production request and preserves logical_run_key", async () => {
    const slateRepo = createInMemoryDailyAgendaSlateRepository();
    const productionRequestRepo = createInMemoryMarketingProductionRequestRepository();
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const slateResult = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: DAY },
      {
        repo: runRepo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => multiCandidateContext(4),
      },
    );
    const service = await createAgendaSlateService({
      slateRepo,
      productionRequestRepo,
      now: NOW,
    });
    const pick = slateResult.slate!.candidates[0]!;
    await service.applyAction({
      slateItemId: pick.slateItemId,
      action: "select_today",
      businessDateKst: DAY,
    });
    const queued = await service.requestProductionForSelected({ businessDateKst: DAY });
    const request = queued.requests[0]!;
    const claimed = await productionRequestRepo.claimNext({
      workerId: "test-worker",
      now: NOW,
    });
    expect(claimed?.logicalRunKey).toBe(request.logicalRunKey);
    await productionRequestRepo.markFailed({
      logicalRunKey: request.logicalRunKey,
      error: "CONTENT_STRATEGIST_FAILED: hermes ENOENT",
      ownership: ownershipFromClaim(claimed!),
      now: NOW,
    });

    const retried = await service.retryFailedProduction({
      slateItemId: pick.slateItemId,
      businessDateKst: DAY,
    });
    expect(retried.request.status).toBe("QUEUED");
    expect(retried.request.logicalRunKey).toBe(request.logicalRunKey);
    expect(retried.request.metadata.requeueCount).toBe(1);
    expect(retried.request.lastError).toBeNull();

    await expect(
      service.retryFailedProduction({
        slateItemId: pick.slateItemId,
        businessDateKst: DAY,
      }),
    ).rejects.toMatchObject({ code: "REQUEUE_REQUIRES_FAILED" });
  });

  it("clears SELECTED_TODAY when production request is COMPLETED", async () => {
    const slateRepo = createInMemoryDailyAgendaSlateRepository();
    const productionRequestRepo = createInMemoryMarketingProductionRequestRepository();
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const slateResult = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: DAY },
      {
        repo: runRepo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => multiCandidateContext(4),
      },
    );
    const service = await createAgendaSlateService({
      slateRepo,
      productionRequestRepo,
      now: NOW,
    });
    const pick = slateResult.slate!.candidates[0]!;
    await service.applyAction({
      slateItemId: pick.slateItemId,
      action: "select_today",
      businessDateKst: DAY,
    });
    const queued = await service.requestProductionForSelected({ businessDateKst: DAY });
    const request = queued.requests[0]!;
    const claimed = await productionRequestRepo.claimNext({
      workerId: "test-worker",
      now: NOW,
    });
    await productionRequestRepo.markCompleted({
      logicalRunKey: request.logicalRunKey,
      completedCandidateId: "cmc_test_completed",
      ownership: ownershipFromClaim(claimed!),
      now: NOW,
    });

    const before = await service.getTodaySlate(DAY);
    expect(before?.observability.selectedTodayCount).toBe(1);

    const reconciled = await service.reconcileTerminalSelections(DAY);
    expect(reconciled?.observability.selectedTodayCount).toBe(0);
    const item = reconciled?.candidates.find((c) => c.slateItemId === pick.slateItemId);
    expect(item?.state).toBe("AVAILABLE");
  });

  it("sets recoveryMode on requeued production execution input", () => {
    const input = buildProductionExecutionInput(
      {
        contract: "marketing-production-request-v1",
        requestId: "mpr_test",
        logicalRunKey: `daily-marketing-production:${DAY}:abc`,
        slateId: "slate_test",
        slateItemId: "asc_aaaaaaaaaaaaaaaaaaaaaaaa",
        businessDateKst: DAY,
        status: "QUEUED",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        claimedAt: null,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        attemptCount: 0,
        claimToken: null,
        lastError: null,
        workerId: null,
        selection: {
          title: "Retry topic",
          summary: "Summary",
          agendaCandidateId: "ac-1",
          researchBriefId: "rb-1",
          rationale: ["reason"],
          recommendedChannel: "threads",
          recommendedFormats: [],
        },
        errorMessage: null,
        completedCandidateId: null,
        metadata: {
          requeueCount: 1,
          requeuedAt: NOW.toISOString(),
        },
      },
      { productId: PRODUCT },
    );
    expect(input.recoveryMode).toBe(true);
  });
});
