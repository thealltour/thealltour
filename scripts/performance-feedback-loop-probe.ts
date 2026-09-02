#!/usr/bin/env node
/**
 * Deterministic STEP 3-9 feedback-loop integration probe (mock adapter, no provider writes).
 *
 *   npx tsx scripts/performance-feedback-loop-probe.ts
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

import type { CompletedMarketingCandidate } from "../src/lib/marketing/cron/daily/types";

async function main() {
  const { createInMemoryContentPerformanceRepository } = await import(
    "../src/lib/marketing/performance/repository/inMemoryContentPerformanceRepository"
  );
  const { createMockSuccessMetricsAdapter } = await import(
    "../src/lib/marketing/performance/adapters/createMetricsAdapter"
  );
  const { ManualPublicationPerformanceCollectionService } = await import(
    "../src/lib/marketing/performance/services/manualPublicationCollectionService"
  );
  const { createPerformanceSignalAdapter } = await import(
    "../src/lib/marketing/performance/research/performanceSignalAdapter"
  );
  const { buildMarketingManagerPerformanceContext } = await import(
    "../src/lib/marketing/performance/integration/marketingManagerPerformanceContext"
  );
  const { buildPerformanceAnalystInput } = await import(
    "../src/lib/marketing/performance/integration/performanceAnalystInput"
  );
  const { PERFORMANCE_COLLECTION_SIDE_EFFECTS_STEP_3_9, PUBLICATION_FLOW_INACTIVE } = await import(
    "../src/lib/marketing/social/publication/governanceBoundary"
  );
  const { jsonContainsForbiddenBotLeak } = await import("../src/lib/marketing/bot/sanitize");

  const perfRepo = createInMemoryContentPerformanceRepository();
  const collectionService = new ManualPublicationPerformanceCollectionService({
    repository: perfRepo,
    adapters: [
      createMockSuccessMetricsAdapter("threads", {
        impressions: 500,
        likes: 25,
        comments: 3,
      }),
    ],
    now: () => new Date("2026-09-02T08:00:00.000Z"),
  });

  const review = {
    contract: "human-marketing-review-v1" as const,
    reviewId: "hmr_probe",
    candidateId: "cmc_probe",
    runId: "run_probe",
    status: "manually_published" as const,
    originalDraft: { title: "t", body: "ai draft", channel: "threads" },
    currentDraft: { title: "t", body: "human edited draft", channel: "threads" },
    humanNotes: null,
    rejectionReason: null,
    deferredUntil: null,
    manualPublication: {
      platform: "threads",
      publishedAt: "2026-09-01T10:00:00.000Z",
      externalPostId: "probe_post_1",
    },
    reviewedBy: "probe",
    governanceReviewedDraftBody: "ai draft",
    humanEditedAfterGovernance: true,
    createdAt: "2026-09-01T09:00:00.000Z",
    updatedAt: "2026-09-02T08:00:00.000Z",
    approvedAt: "2026-09-01T09:30:00.000Z",
    manuallyPublishedAt: "2026-09-01T10:00:00.000Z",
  };

  const candidate = {
    contract: "completed-marketing-candidate-v1" as const,
    candidateId: "cmc_probe",
    runId: "run_probe",
    logicalRunKey: "probe:2026-09-02",
    businessDateKst: "2026-09-02",
    status: "ready_for_human_review" as const,
    selectedAgenda: {
      title: "Probe topic",
      summary: "probe",
      destinations: ["japan"],
      topics: ["travel"],
      commercialIntent: "awareness",
      rationale: ["probe"],
      provenance: {},
    },
    contentAssignment: {
      assignmentId: "asgn_probe",
      evidenceRefs: [],
      matchedProductIds: [],
      commercialIntent: "awareness",
    },
    contentPlan: {
      recommendedFormats: [{ format: "thread", channel: "threads" }],
      primaryAngle: "probe",
      hook: "hook",
      keyMessage: "msg",
      outline: [],
      ctaStrategy: "cta",
      riskNotes: [],
    },
    draft: { title: "t", body: "human edited draft", channel: "threads" },
    governanceDecision: {
      contract: "governance-decision-v1" as const,
      reviewId: "gov_probe",
      assignmentId: "asgn_probe",
      decidedAt: "2026-09-01T08:00:00.000Z",
      decision: "ALLOW" as const,
      reasons: ["NO_RISK_SIGNAL"],
      unsupportedClaims: [],
      factualRisks: [],
      evidenceGaps: [],
      commercialRisks: [],
      policyRisks: [],
      requiredRevisions: [],
      verifiedEvidenceRefs: [],
      riskScore: 0,
      humanApprovalRequired: false,
      semanticAvailable: true,
      revisionHints: [],
      claimCount: 1,
      unsupportedClaimCount: 0,
      evidenceGapCount: 0,
      malformed: false,
    },
    revisionHistory: [],
    provenance: {
      routineId: "daily-marketing-plan",
      correlationId: "probe",
      researchStatus: "ok",
      governanceReviewId: "gov_probe",
    },
    observability: {
      runId: "run_probe",
      logicalRunKey: "probe:2026-09-02",
      businessDateKst: "2026-09-02",
      correlationId: "probe",
      researchStatus: "ok",
      candidateCount: 1,
      selectedAgendaId: null,
      assignmentId: "asgn_probe",
      governanceReviewId: "gov_probe",
      revisionCount: 0,
      governanceDecision: "ALLOW",
      finalCandidateId: "cmc_probe",
      finalStatus: "ready_for_human_review",
      startedAt: "2026-09-01T08:00:00.000Z",
      completedAt: "2026-09-02T08:00:00.000Z",
      failureReason: null,
    },
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-02T08:00:00.000Z",
  } as unknown as CompletedMarketingCandidate;

  const collected = await collectionService.collectPerformanceForManualPublication({
    review,
    candidate,
    correlationId: "probe",
  });

  const snapshots = await perfRepo.listRecent({ limit: 5 });
  const signalAdapter = createPerformanceSignalAdapter(perfRepo);
  const signals = await signalAdapter.loadNormalizedSignals({ since: "2026-01-01T00:00:00.000Z" });
  const mmContext = buildMarketingManagerPerformanceContext(snapshots);
  const paInput = buildPerformanceAnalystInput({ snapshots });

  const payload = {
    publicationFlowInactive: PUBLICATION_FLOW_INACTIVE,
    performanceCollectionSideEffects: PERFORMANCE_COLLECTION_SIDE_EFFECTS_STEP_3_9,
    collectionStatus: collected.snapshot?.collectionStatus,
    contentOrigin: collected.snapshot?.contentOrigin,
    snapshotId: collected.snapshot?.snapshotId,
    signalCount: signals.length,
    signalType: signals[0]?.signalType ?? null,
    mmAdvisoryOnly: mmContext.advisoryOnly,
    paEvidenceLines: paInput.evidenceLines.length,
    humanEditedAttribution: mmContext.humanEditedAttribution,
    forbiddenLeak: jsonContainsForbiddenBotLeak({ collected, signals, mmContext }),
    liveProviderRead: "LIVE PROVIDER READ UNEXERCISED — no safe real manually-published post with official read credentials",
  };

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
