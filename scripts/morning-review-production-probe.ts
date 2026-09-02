#!/usr/bin/env node
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("module") as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string;
};
const originalResolve = Module._resolveFilename.bind(Module);
const serverOnlyStub = require.resolve("./shims/server-only.js");
Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") return serverOnlyStub;
  return originalResolve(request, parent, isMain, options);
};

import { loadLocalEnv } from "./loadLocalEnv";
loadLocalEnv();

import { createHumanMarketingReviewService } from "../src/lib/marketing/review/humanMarketingReviewService";

const CANDIDATE_ID = "cmc_daily_marketing_plan_2026_09_02";
const REVIEW_ID = "hmr_0893448246ea760d";

async function main() {
  const service = await createHumanMarketingReviewService();
  const queue = await service.listMorningReviewQueue("all");
  const context = await service.getMorningMarketingReviewContext(CANDIDATE_ID);
  const row = queue.items.find((item) => item.candidateId === CANDIDATE_ID);

  console.log(
    JSON.stringify(
      {
        candidateId: CANDIDATE_ID,
        expectedReviewId: REVIEW_ID,
        queuePendingCount: queue.pendingCount,
        todayCandidateId: queue.todayCandidate?.candidateId ?? null,
        inPendingQueue: queue.items.some(
          (item) =>
            item.candidateId === CANDIDATE_ID &&
            (item.reviewWorkflowState === "pending" || item.reviewWorkflowState === "editing"),
        ),
        row: row
          ? {
              title: row.title,
              governanceDecision: row.governanceDecision,
              reviewWorkflowState: row.reviewWorkflowState,
              actionLabel: row.actionLabel,
              actionNeeded: row.actionNeeded,
              operationalMessage: row.operationalMessage,
              isToday: row.isToday,
            }
          : null,
        context: context
          ? {
              reviewId: context.identity.reviewId,
              reviewIdMatch: context.identity.reviewId === REVIEW_ID,
              reviewStatus: context.identity.reviewStatus,
              candidateStatus: context.identity.candidateStatus,
              governanceDecision: context.governance.decision,
              governanceSummary: context.governance.summary,
              humanActionStatus: context.humanAction.status,
              canApprove: context.humanAction.canApprove,
              humanApproved: context.humanAction.status === "approved_for_manual_publish",
              manuallyPublished: context.humanAction.status === "manually_published",
              operationsNotice: context.operations.notice,
              priorIncidentCount: context.operations.priorIncidentCount,
              executionAttempt: context.operations.executionAttempt,
              draftBodyLength: context.draft.body.length,
            }
          : null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
