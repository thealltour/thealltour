#!/usr/bin/env node
/**
 * Collect read-only performance for recently manually-published human reviews.
 * Runs before 08:30 Performance Analyst brief (conservative, no aggressive polling).
 *
 *   npx tsx scripts/cron-collect-manual-performance.ts
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("module") as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string;
};
const originalResolve = Module._resolveFilename.bind(Module);
const serverOnlyStub = require.resolve("./shims/server-only.js");
Module._resolveFilename = function resolveFilename(
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: unknown,
) {
  if (request === "server-only") return serverOnlyStub;
  return originalResolve(request, parent, isMain, options);
};

import { loadLocalEnv } from "./loadLocalEnv";
loadLocalEnv();

async function main() {
  const { createHumanMarketingReviewRepository } = await import(
    "../src/lib/marketing/review/repository/createHumanMarketingReviewRepository"
  );
  const { createDailyMarketingRunRepository } = await import(
    "../src/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository"
  );
  const { createManualPublicationPerformanceCollectionService } = await import(
    "../src/lib/marketing/performance/services/manualPublicationCollectionService"
  );
  const { PERFORMANCE_COLLECTION_SIDE_EFFECTS_STEP_3_9, PUBLICATION_FLOW_INACTIVE } = await import(
    "../src/lib/marketing/social/publication/governanceBoundary"
  );

  const reviewRepo = await createHumanMarketingReviewRepository();
  const candidateRepo = await createDailyMarketingRunRepository();
  const collectionService = await createManualPublicationPerformanceCollectionService();

  const reviews = await reviewRepo.listReviews({ limit: 50 });
  const manuallyPublished = reviews.filter((r) => r.status === "manually_published" && r.manualPublication);

  const results = [];
  for (const review of manuallyPublished) {
    if (review.candidateId === "cmc_step_3_8_verification") {
      results.push({ candidateId: review.candidateId, skipped: "step_3_8_verification_fixture" });
      continue;
    }
    const candidate = await candidateRepo.findCandidateByCandidateId(review.candidateId);
    if (!candidate) {
      results.push({ candidateId: review.candidateId, error: "candidate_not_found" });
      continue;
    }
    const collected = await collectionService.collectPerformanceForManualPublication({
      review,
      candidate,
      correlationId: "cron-collect-manual-performance",
    });
    results.push({
      candidateId: review.candidateId,
      reviewId: review.reviewId,
      eligibility: collected.eligibility.status,
      collectionStatus: collected.snapshot?.collectionStatus ?? collected.eligibility.status,
      snapshotId: collected.snapshot?.snapshotId ?? null,
      idempotentReuse: collected.idempotentReuse ?? false,
    });
  }

  console.log(
    JSON.stringify(
      {
        publicationFlowInactive: PUBLICATION_FLOW_INACTIVE,
        performanceCollectionSideEffects: PERFORMANCE_COLLECTION_SIDE_EFFECTS_STEP_3_9,
        processed: results.length,
        results,
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
