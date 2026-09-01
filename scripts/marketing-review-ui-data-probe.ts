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
import { VERIFICATION_PURPOSE } from "../src/lib/marketing/review/verification/buildVerificationCandidate";

const CANDIDATE_ID = "cmc_step_3_8_verification";

async function main() {
  const service = await createHumanMarketingReviewService();
  const queue = await service.listHumanReviewQueue("all");
  const detail = await service.getHumanReviewDetail(CANDIDATE_ID);
  const item = queue.items.find((row) => row.candidateId === CANDIDATE_ID);

  console.log(
    JSON.stringify(
      {
        purpose: VERIFICATION_PURPOSE,
        queueCount: queue.items.length,
        queueItem: item,
        detail: detail
          ? {
              title: detail.candidate.selectedAgenda.title,
              candidateStatus: detail.candidate.status,
              humanReviewStatus: detail.review?.status ?? null,
              governanceDecision: detail.candidate.governanceDecision?.decision ?? null,
              governanceStale: detail.governanceStale,
              canMarkManuallyPublished: detail.canMarkManuallyPublished,
              evidenceCount: detail.candidate.contentAssignment.evidenceRefs.length,
              hasContentPlan: Boolean(detail.candidate.contentPlan),
              originalDraftLength: detail.review?.originalDraft.body.length ?? 0,
              currentDraftLength: detail.review?.currentDraft.body.length ?? 0,
              humanEditedAfterGovernance: detail.review?.humanEditedAfterGovernance ?? false,
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
