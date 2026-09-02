#!/usr/bin/env node
/**
 * STEP 3-13: bootstrap missing HumanMarketingReview records for eligible candidates.
 *
 *   npx tsx scripts/bootstrap-human-marketing-reviews.ts --candidateId=cmc_daily_marketing_plan_2026_09_02
 *   npx tsx scripts/bootstrap-human-marketing-reviews.ts --businessDate=2026-09-02
 *   npx tsx scripts/bootstrap-human-marketing-reviews.ts --dry-run --candidateId=...
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

type CliOptions = {
  candidateId?: string;
  businessDateKst?: string;
  dryRun: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const candidateArg = argv.find((item) => item.startsWith("--candidateId="));
  const businessDateArg = argv.find((item) => item.startsWith("--businessDate="));
  return {
    candidateId: candidateArg?.split("=")[1]?.trim(),
    businessDateKst: businessDateArg?.split("=")[1]?.trim(),
    dryRun: argv.includes("--dry-run"),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { createDailyMarketingRunRepository } = await import(
    "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository"
  );
  const { createHumanMarketingReviewRepository } = await import(
    "@/lib/marketing/review/repository/createHumanMarketingReviewRepository"
  );
  const { bootstrapMissingHumanMarketingReviews } = await import("@/lib/marketing/review/bootstrap");
  const { isCandidateEligibleForHumanReview } = await import("@/lib/marketing/review/bootstrap/eligibility");

  const candidateRepo = await createDailyMarketingRunRepository({ backend: "supabase" });
  const reviewRepo = await createHumanMarketingReviewRepository({ backend: "supabase" });

  const before = {
    capturedAt: new Date().toISOString(),
    candidateId: options.candidateId ?? null,
    businessDateKst: options.businessDateKst ?? null,
    dryRun: options.dryRun,
  };

  if (options.candidateId) {
    const candidate = await candidateRepo.findCandidateByCandidateId(options.candidateId);
    const existingReview = await reviewRepo.findByCandidateId(options.candidateId);
    console.log(
      JSON.stringify(
        {
          ...before,
          phase: "inspect",
          candidate: candidate
            ? {
                candidateId: candidate.candidateId,
                status: candidate.status,
                governanceDecision: candidate.governanceDecision?.decision ?? null,
                eligible: isCandidateEligibleForHumanReview(candidate),
              }
            : null,
          existingReview: existingReview
            ? { reviewId: existingReview.reviewId, status: existingReview.status }
            : null,
        },
        null,
        2,
      ),
    );
    if (!candidate) {
      process.exitCode = 1;
      return;
    }
    if (!isCandidateEligibleForHumanReview(candidate)) {
      console.error("candidate_not_eligible_for_human_review");
      process.exitCode = 1;
      return;
    }
  }

  if (options.dryRun) {
    console.log(JSON.stringify({ ...before, phase: "dry_run_complete" }, null, 2));
    return;
  }

  const result = await bootstrapMissingHumanMarketingReviews({
    candidateRepo,
    reviewRepo,
    candidateId: options.candidateId,
    businessDateKst: options.businessDateKst,
  });

  const reviewIds =
    options.candidateId != null
      ? [(await reviewRepo.findByCandidateId(options.candidateId))?.reviewId ?? null]
      : [];

  console.log(
    JSON.stringify(
      {
        ...before,
        phase: "bootstrap_complete",
        result,
        reviewIds,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
