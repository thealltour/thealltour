#!/usr/bin/env node
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

import { createHumanMarketingReviewService } from "../src/lib/marketing/review/humanMarketingReviewService";
import { createDailyMarketingRunRepository } from "../src/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { PUBLICATION_FLOW_INACTIVE, SNS_SIDE_EFFECTS_STEP_3_8 } from "../src/lib/marketing/social/publication/governanceBoundary";

import {
  VERIFICATION_PURPOSE,
  buildVerificationIdentity,
} from "../src/lib/marketing/review/verification/buildVerificationCandidate";

async function resolveCandidate(
  candidateRepo: Awaited<ReturnType<typeof createDailyMarketingRunRepository>>,
): Promise<{ candidateId: string; logicalRunKey: string } | null> {
  const argIdx = process.argv.indexOf("--candidate-id");
  const candidateIdArg = argIdx >= 0 ? process.argv[argIdx + 1] : undefined;
  if (candidateIdArg) {
    const found = await candidateRepo.findCandidateByCandidateId(candidateIdArg);
    if (!found) throw new Error(`candidate_not_found:${candidateIdArg}`);
    return { candidateId: found.candidateId, logicalRunKey: found.logicalRunKey };
  }

  const verification = buildVerificationIdentity();
  const verificationCandidate = await candidateRepo.findCandidateByCandidateId(verification.candidateId);
  if (verificationCandidate) {
    return { candidateId: verificationCandidate.candidateId, logicalRunKey: verificationCandidate.logicalRunKey };
  }

  const candidates = await candidateRepo.listCandidates({ limit: 5 });
  if (candidates.length === 0) return null;
  return { candidateId: candidates[0].candidateId, logicalRunKey: candidates[0].logicalRunKey };
}

async function main() {
  const candidateRepo = await createDailyMarketingRunRepository({ backend: "supabase" });
  const resolved = await resolveCandidate(candidateRepo);
  if (!resolved) {
    console.log("ROUNDTRIP SKIP — no completed_marketing_candidates in remote Supabase");
    console.log("Hint: npx tsx scripts/seed-marketing-review-verification-candidate.ts");
    return;
  }

  const { candidateId } = resolved;
  const service = await createHumanMarketingReviewService({ candidateRepo });

  const pending = await service.getOrCreateHumanReview(candidateId, "roundtrip-admin");
  console.log(JSON.stringify({ step: "pending", reviewId: pending.reviewId, status: pending.status }, null, 2));

  const edited = await service.updateHumanDraft({
    candidateId,
    draft: {
      title: pending.currentDraft.title,
      body: `${pending.currentDraft.body}\n\n[roundtrip edit]`,
      channel: pending.currentDraft.channel,
    },
    reviewedBy: "roundtrip-admin",
  });
  console.log(
    JSON.stringify(
      {
        step: "editing",
        status: edited.status,
        humanEditedAfterGovernance: edited.humanEditedAfterGovernance,
        originalDraftUnchanged: edited.originalDraft.body === pending.originalDraft.body,
        currentDraftChanged: edited.currentDraft.body !== pending.currentDraft.body,
      },
      null,
      2,
    ),
  );

  const approved = await service.approveForManualPublish({
    candidateId,
    humanNotes: "roundtrip approve only",
    reviewedBy: "roundtrip-admin",
  });

  const duplicate = await service.getOrCreateHumanReview(candidateId, "roundtrip-admin");

  console.log(
    JSON.stringify(
      {
        step: "approved_for_manual_publish",
        publicationFlowInactive: PUBLICATION_FLOW_INACTIVE,
        snsSideEffects: SNS_SIDE_EFFECTS_STEP_3_8,
        purpose: VERIFICATION_PURPOSE,
        candidateId,
        reviewId: approved.reviewId,
        reviewStatus: approved.status,
        approvedAt: approved.approvedAt,
        humanEditedAfterGovernance: approved.humanEditedAfterGovernance,
        idempotentReviewId: duplicate.reviewId,
        idempotentSameReview: duplicate.reviewId === approved.reviewId,
        stoppedAt: "approved_for_manual_publish",
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
