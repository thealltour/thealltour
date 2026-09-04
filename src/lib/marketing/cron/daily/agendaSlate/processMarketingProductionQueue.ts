import { hostname } from "node:os";

import type { DailyMarketingPipelineDeps } from "@/lib/marketing/cron/daily/runDailyMarketingProductionPipeline";
import { runDailyMarketingProductionFromSelection } from "@/lib/marketing/cron/daily/runDailyMarketingProductionFromSelection";
import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import {
  DEFAULT_PRODUCTION_WORKER_MAX_BATCH,
  resolveProductionStaleAfterMs,
} from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import type { MarketingProductionRequestRepository } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import { ownershipFromClaim } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import type { CompletedMarketingCandidate, DailyMarketingPipelineResult } from "@/lib/marketing/cron/daily/types";
import { bootstrapHumanReviewForCandidate } from "@/lib/marketing/review/bootstrap/bootstrapHumanReview";
import type { HumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";

export type ProcessProductionQueueResult = {
  dryRun: boolean;
  workerId: string;
  claimableCount: number;
  processed: Array<{
    logicalRunKey: string;
    slateItemId: string;
    outcome:
      | "completed"
      | "failed"
      | "skipped_terminal"
      | "ownership_lost"
      | "would_claim";
    status: MarketingProductionRequest["status"];
    completedCandidateId: string | null;
    lastError: string | null;
    idempotent: boolean;
    humanReviewRecovered?: boolean;
  }>;
};

export type EnsureHumanReviewBoundaryResult =
  | { ok: true; outcome: "created" | "reused" | "skipped"; reviewId: string | null }
  | { ok: false; error: string };

/**
 * Establish Human Review boundary without re-running AI production.
 * created/reused/skipped → ok; failed → not ok (must not COMPLETED).
 */
export async function ensureHumanReviewBoundaryForCandidate(
  candidate: CompletedMarketingCandidate,
  reviewRepo: HumanMarketingReviewRepository,
  now?: Date,
): Promise<EnsureHumanReviewBoundaryResult> {
  const result = await bootstrapHumanReviewForCandidate(candidate, {
    reviewRepo,
    now: () => now ?? new Date(),
  });
  if (result.outcome === "failed") {
    return { ok: false, error: result.error };
  }
  if (result.outcome === "skipped") {
    return { ok: true, outcome: "skipped", reviewId: null };
  }
  return { ok: true, outcome: result.outcome, reviewId: result.review.reviewId };
}

export type ProductionQueueWorkerDeps = {
  productionRequestRepo: MarketingProductionRequestRepository;
  runRepo: DailyMarketingRunRepository;
  reviewRepo: HumanMarketingReviewRepository;
  /** Injected production runner — tests pass a stub; CLI wires real FromSelection. */
  executeProduction: (request: MarketingProductionRequest) => Promise<DailyMarketingPipelineResult>;
  now?: Date;
  workerId?: string;
  maxBatch?: number;
  staleAfterMs?: number;
  productId?: string;
};

export function defaultProductionWorkerId(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.MARKETING_PRODUCTION_WORKER_ID?.trim();
  if (configured) return configured.slice(0, 80);
  return `pi:${hostname()}`.slice(0, 80);
}

/**
 * One-shot sequential queue processor.
 * Dry-run lists claimable work without status transitions or AI production.
 */
export async function processMarketingProductionQueue(input: {
  dryRun?: boolean;
  maxBatch?: number;
  staleAfterMs?: number;
  workerId?: string;
  now?: Date;
  deps: ProductionQueueWorkerDeps;
}): Promise<ProcessProductionQueueResult> {
  const now = input.now ?? input.deps.now ?? new Date();
  const dryRun = Boolean(input.dryRun);
  const maxBatch = Math.min(
    Math.max(1, input.maxBatch ?? input.deps.maxBatch ?? DEFAULT_PRODUCTION_WORKER_MAX_BATCH),
    DEFAULT_PRODUCTION_WORKER_MAX_BATCH,
  );
  const staleAfterMs = resolveProductionStaleAfterMs(process.env, input.staleAfterMs ?? input.deps.staleAfterMs);
  const workerId = (input.workerId ?? input.deps.workerId ?? defaultProductionWorkerId()).trim();
  if (!workerId) throw new Error("WORKER_ID_REQUIRED");

  const repo = input.deps.productionRequestRepo;
  const claimable = await repo.listClaimable({ limit: maxBatch, staleAfterMs, now });

  if (dryRun) {
    return {
      dryRun: true,
      workerId,
      claimableCount: claimable.length,
      processed: claimable.map((req) => ({
        logicalRunKey: req.logicalRunKey,
        slateItemId: req.slateItemId,
        outcome: "would_claim" as const,
        status: req.status,
        completedCandidateId: req.completedCandidateId,
        lastError: req.lastError,
        idempotent: false,
      })),
    };
  }

  const processed: ProcessProductionQueueResult["processed"] = [];

  for (let i = 0; i < maxBatch; i += 1) {
    const claimed = await repo.claimNext({ workerId, staleAfterMs, now });
    if (!claimed) break;

    if (claimed.status === "COMPLETED" || claimed.status === "FAILED") {
      processed.push({
        logicalRunKey: claimed.logicalRunKey,
        slateItemId: claimed.slateItemId,
        outcome: "skipped_terminal",
        status: claimed.status,
        completedCandidateId: claimed.completedCandidateId,
        lastError: claimed.lastError,
        idempotent: true,
      });
      continue;
    }

    const ownership = ownershipFromClaim(claimed);

    try {
      // Prefer durable candidate barrier before invoking AI (crash recovery).
      const existingCandidate = await input.deps.runRepo.findCandidateByLogicalKey(
        claimed.logicalRunKey,
      );
      if (existingCandidate) {
        const boundary = await ensureHumanReviewBoundaryForCandidate(
          existingCandidate,
          input.deps.reviewRepo,
          now,
        );
        if (!boundary.ok) {
          const failed = await repo.markFailed({
            logicalRunKey: claimed.logicalRunKey,
            error: `hmr_recovery_failed:${boundary.error}`,
            ownership,
            now,
          });
          processed.push({
            logicalRunKey: claimed.logicalRunKey,
            slateItemId: claimed.slateItemId,
            outcome: failed.ok ? "failed" : "ownership_lost",
            status: failed.request?.status ?? claimed.status,
            completedCandidateId: null,
            lastError: failed.request?.lastError ?? boundary.error,
            idempotent: true,
            humanReviewRecovered: false,
          });
          continue;
        }

        const completed = await repo.markCompleted({
          logicalRunKey: claimed.logicalRunKey,
          completedCandidateId: existingCandidate.candidateId,
          ownership,
          now,
        });
        processed.push({
          logicalRunKey: claimed.logicalRunKey,
          slateItemId: claimed.slateItemId,
          outcome: completed.ok ? "completed" : "ownership_lost",
          status: completed.request?.status ?? claimed.status,
          completedCandidateId: completed.request?.completedCandidateId ?? null,
          lastError: completed.ok ? null : completed.reason,
          idempotent: true,
          humanReviewRecovered: boundary.outcome === "created",
        });
        continue;
      }

      const result = await input.deps.executeProduction(claimed);
      const candidate =
        result.candidate ??
        (result.run.completedCandidateId
          ? await input.deps.runRepo.findCandidateByCandidateId(result.run.completedCandidateId)
          : null);
      const candidateId = candidate?.candidateId ?? result.run.completedCandidateId ?? null;

      if (!candidateId || !candidate) {
        const failed = await repo.markFailed({
          logicalRunKey: claimed.logicalRunKey,
          error: result.run.failureReason ?? "production_returned_no_candidate",
          ownership,
          now,
        });
        processed.push({
          logicalRunKey: claimed.logicalRunKey,
          slateItemId: claimed.slateItemId,
          outcome: failed.ok ? "failed" : "ownership_lost",
          status: failed.request?.status ?? claimed.status,
          completedCandidateId: null,
          lastError: failed.request?.lastError ?? "production_returned_no_candidate",
          idempotent: false,
        });
        continue;
      }

      // Pipeline may persist candidate even when HMR bootstrap failed — enforce boundary.
      const boundary = await ensureHumanReviewBoundaryForCandidate(
        candidate,
        input.deps.reviewRepo,
        now,
      );
      if (!boundary.ok) {
        const failed = await repo.markFailed({
          logicalRunKey: claimed.logicalRunKey,
          error: `hmr_boundary_failed:${boundary.error}`,
          ownership,
          now,
        });
        processed.push({
          logicalRunKey: claimed.logicalRunKey,
          slateItemId: claimed.slateItemId,
          outcome: failed.ok ? "failed" : "ownership_lost",
          status: failed.request?.status ?? claimed.status,
          completedCandidateId: null,
          lastError: failed.request?.lastError ?? boundary.error,
          idempotent: Boolean(result.idempotent),
          humanReviewRecovered: false,
        });
        continue;
      }

      const completed = await repo.markCompleted({
        logicalRunKey: claimed.logicalRunKey,
        completedCandidateId: candidateId,
        ownership,
        now,
      });
      processed.push({
        logicalRunKey: claimed.logicalRunKey,
        slateItemId: claimed.slateItemId,
        outcome: completed.ok ? "completed" : "ownership_lost",
        status: completed.request?.status ?? claimed.status,
        completedCandidateId: completed.request?.completedCandidateId ?? null,
        lastError: completed.ok ? null : completed.reason,
        idempotent: Boolean(result.idempotent),
        humanReviewRecovered: boundary.outcome === "created",
      });
    } catch (error) {
      const failed = await repo.markFailed({
        logicalRunKey: claimed.logicalRunKey,
        error,
        ownership,
        now,
      });
      processed.push({
        logicalRunKey: claimed.logicalRunKey,
        slateItemId: claimed.slateItemId,
        outcome: failed.ok ? "failed" : "ownership_lost",
        status: failed.request?.status ?? claimed.status,
        completedCandidateId: null,
        lastError: failed.request?.lastError ?? (error instanceof Error ? error.message : "error"),
        idempotent: false,
      });
    }
  }

  return {
    dryRun: false,
    workerId,
    claimableCount: claimable.length,
    processed,
  };
}

export function buildProductionExecutionInput(
  request: MarketingProductionRequest,
  defaults: { productId: string; channel?: string },
) {
  const productId =
    (typeof request.metadata.productId === "string" && request.metadata.productId.trim()) ||
    defaults.productId;
  const channel =
    request.selection.recommendedChannel?.trim() || defaults.channel || "threads";
  const canonicalArticleIds = Array.isArray(request.metadata.canonicalArticleIds)
    ? (request.metadata.canonicalArticleIds as string[])
    : undefined;

  return {
    productId,
    channel,
    businessDateKst: request.businessDateKst,
    logicalRunKey: request.logicalRunKey,
    correlationId: `production-queue:${request.requestId}:${request.attemptCount}`,
    selection: {
      title: request.selection.title,
      summary: request.selection.summary,
      agendaCandidateId: request.selection.agendaCandidateId,
      researchBriefId: request.selection.researchBriefId,
      rationale: request.selection.rationale,
    },
    canonicalArticleIds,
    managerRationale: request.selection.rationale,
    usePerSelectionLogicalRunKey: true,
  };
}

/**
 * Wire real FromSelection for CLI — still Human Review bounded (no publish).
 */
export function createDefaultProductionExecutor(deps: {
  pipelineDeps: DailyMarketingPipelineDeps;
  productId: string;
  channel?: string;
}): (request: MarketingProductionRequest) => Promise<DailyMarketingPipelineResult> {
  return async (request) => {
    const input = buildProductionExecutionInput(request, {
      productId: deps.productId,
      channel: deps.channel,
    });
    return runDailyMarketingProductionFromSelection(input, deps.pipelineDeps);
  };
}
