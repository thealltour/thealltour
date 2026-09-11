#!/usr/bin/env node
/**
 * CG-3 production-safe canary:
 * MediaBrief → ShortVideoBrief → Resolve → Explicit PICK → automatic RenderJob enqueue
 * → wait Mini-PC timer → READY + durable shortform.mp4
 *
 * Does NOT approve for publication or publish externally.
 * Does NOT manually invoke the worker.
 *
 *   npx tsx scripts/cg3-shortform-pick-enqueue-canary.ts
 */
import { createRequire } from "node:module";
import { copyFileSync, createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";

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

const CANDIDATE_ID = "cmc_cg3_pick_enqueue_canary";
const BUSINESS_DATE = "2026-09-11";
const ROUTINE_ID = "cg3-pick-enqueue-canary";
const PURPOSE = "cg3-pick-enqueue-canary";
const MANAGED_RELATIVE_PATH = "source/own/cg3-pick-enqueue-canary.mp4";
const SOURCE_FIXTURE =
  "/mnt/HDD2TB/marketing-assets/source/own/sv8c3a-first-e2e.mp4";
const VISUAL_SUBJECT = "travel lifestyle city walk";

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const now = new Date();
  const {
    prepareManagerToContentHandoff,
  } = await import("@/lib/marketing/bot/organization/handoffs");
  const { mapManagerEvidenceRef } = await import("@/lib/marketing/bot/organization/evidence");
  const { officialEvidence } = await import("@/lib/marketing/assets/__tests__/fixtures");
  const { MEDIA_BRIEF_CONTRACT } = await import("@/lib/marketing/assets/contracts");
  const { resolveMarketingAssetRoot } = await import("@/lib/marketing/assets/config");
  const { stableJsonBytes } = await import("@/lib/marketing/assets/hashing");
  const { ensurePackageLayout, resolvePackageDirectory } = await import(
    "@/lib/marketing/assets/paths"
  );
  const { writePackageArtifact } = await import("@/lib/marketing/assets/writeArtifact");
  const { MEDIA_BRIEF_RELATIVE_PATH } = await import("@/lib/marketing/assets/video/paths");
  const { isShortVideoBriefGenerationApplicable } = await import(
    "@/lib/marketing/assets/shortVideoBrief/gating"
  );
  const { buildShortVideoBrief } = await import(
    "@/lib/marketing/assets/shortVideoBrief/buildShortVideoBrief"
  );
  const { persistShortVideoBrief } = await import(
    "@/lib/marketing/assets/shortVideoBrief/persist"
  );
  const {
    DAILY_SHORTFORM_COMMITMENT_CONTRACT,
    DAILY_SHORTFORM_COMMITMENT_RELATIVE_PATH,
  } = await import("@/lib/marketing/assets/shortform/dailyShortformBridge");
  const { SHORTFORM_FINAL_RELATIVE_PATH } = await import(
    "@/lib/marketing/assets/shortform/production/paths"
  );
  const { createMarketingMediaSourceCatalogRepository } = await import(
    "@/lib/marketing/assets/sourceCatalog/createSourceCatalogRepository"
  );
  const {
    pickShortformSourceForReview,
    resolveShortformSourcesForReview,
  } = await import("@/lib/marketing/assets/shortform/review/service");
  const { evaluateShortformRenderReady } = await import(
    "@/lib/marketing/assets/shortform/renderReady"
  );
  const { createShortformVideoRenderJobRepository } = await import(
    "@/lib/marketing/assets/shortform/renderJob/createRepository"
  );
  const { createDailyMarketingRunRepository } = await import(
    "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository"
  );
  const {
    COMPLETED_MARKETING_CANDIDATE_CONTRACT,
    DAILY_MARKETING_RUN_CONTRACT,
  } = await import("@/lib/marketing/cron/daily/types");
  const { GOVERNANCE_DECISION_CONTRACT } = await import(
    "@/lib/marketing/content/governance/types"
  );

  const logicalRunKey = `${ROUTINE_ID}:${BUSINESS_DATE}`;
  const handoff = prepareManagerToContentHandoff(
    {
      title: "[CG-3] Pick→enqueue canary",
      summary: "Safe CG-3 canary candidate.",
      rationale: ["cg3-canary", "internal_catalog-first", "no-publish"],
      agendaCandidateId: "ac-cg3-canary",
      researchBriefId: "rb-cg3-canary",
      researchScoreAtSelection: 0.7,
      evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.8)],
      matchedProductIds: [],
      idempotencyKey: logicalRunKey,
      constraints: ["verification-only", "no-auto-publish", "cg3"],
    },
    { now },
  );

  const draft = {
    title: "CG-3 canary shortform",
    body: "여행은 여유롭게 준비할수록 편해집니다.\n\n출발 전에 공식 안내를 다시 확인하세요.",
    channel: "instagram",
    agenda: "CG-3 canary",
    sourceReferences: ["evidence:ev-official"],
  };

  const governance = {
    contract: GOVERNANCE_DECISION_CONTRACT,
    reviewId: `gov_${PURPOSE}`,
    assignmentId: handoff.contentAssignment.assignmentId,
    decidedAt: now.toISOString(),
    decision: "ALLOW" as const,
    reasons: ["NO_RISK_SIGNAL"],
    unsupportedClaims: [],
    factualRisks: [],
    evidenceGaps: [],
    commercialRisks: [],
    policyRisks: [],
    requiredRevisions: [],
    verifiedEvidenceRefs: ["ev-official"],
    riskScore: 0,
    humanApprovalRequired: false,
    semanticAvailable: true,
    revisionHints: [],
    claimCount: 1,
    unsupportedClaimCount: 0,
    evidenceGapCount: 0,
    malformed: false,
    revisionNumber: 0,
  };

  const observability = {
    runId: `run_${PURPOSE}`,
    logicalRunKey,
    businessDateKst: BUSINESS_DATE,
    correlationId: `cg3:${PURPOSE}`,
    researchStatus: "ok",
    candidateCount: 1,
    selectedAgendaId: handoff.selectedAgenda.id,
    assignmentId: handoff.contentAssignment.assignmentId,
    governanceReviewId: governance.reviewId,
    revisionCount: 0,
    governanceDecision: "ALLOW",
    finalCandidateId: CANDIDATE_ID,
    finalStatus: "ready_for_human_review",
    startedAt: now.toISOString(),
    completedAt: now.toISOString(),
    failureReason: null,
  };

  const candidate = {
    contract: COMPLETED_MARKETING_CANDIDATE_CONTRACT,
    candidateId: CANDIDATE_ID,
    runId: observability.runId,
    logicalRunKey,
    businessDateKst: BUSINESS_DATE,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    selectedAgenda: handoff.selectedAgenda,
    contentAssignment: {
      ...handoff.contentAssignment,
      formatHints: [
        ...handoff.contentAssignment.formatHints,
        { format: "short_video_concept" as const, score: 0.9, rationale: "cg3 canary" },
      ],
    },
    contentPlan: handoff.contentPlanScaffold
      ? {
          ...handoff.contentPlanScaffold,
          recommendedFormats: [
            ...(handoff.contentPlanScaffold.recommendedFormats ?? []),
            { format: "short_video_concept" as const, score: 0.9, rationale: "cg3 canary" },
          ],
        }
      : null,
    draft,
    governanceDecision: governance,
    status: "ready_for_human_review" as const,
    revisionHistory: [{ revisionNumber: 0, governanceDecision: "ALLOW" }],
    provenance: {
      routineId: ROUTINE_ID,
      correlationId: observability.correlationId,
      researchStatus: "ok",
      governanceReviewId: governance.reviewId,
    },
    observability,
  };

  const run = {
    contract: DAILY_MARKETING_RUN_CONTRACT,
    runId: observability.runId,
    logicalRunKey,
    businessDateKst: BUSINESS_DATE,
    routineId: ROUTINE_ID,
    correlationId: observability.correlationId,
    executionAttempt: 1,
    startedAt: now.toISOString(),
    completedAt: now.toISOString(),
    status: "completed" as const,
    researchStatus: "ok",
    selectedAgendaId: handoff.selectedAgenda.id,
    assignmentId: handoff.contentAssignment.assignmentId,
    governanceReviewId: governance.reviewId,
    completedCandidateId: CANDIDATE_ID,
    failureReason: null,
    metadata: { purpose: PURPOSE },
    observability,
  };

  const repo = await createDailyMarketingRunRepository({ backend: "supabase" });
  const existing = await repo.findCandidateByCandidateId(CANDIDATE_ID);
  if (!existing) {
    await repo.saveRun(run as never);
    await repo.saveCandidate(candidate as never);
  }

  const assetRoot = resolveMarketingAssetRoot({ env: process.env });
  const packageRoot = resolvePackageDirectory({
    assetRoot,
    businessDateKst: BUSINESS_DATE,
    candidateId: CANDIDATE_ID,
  });
  ensurePackageLayout(packageRoot);

  const mediaBrief = {
    contract: MEDIA_BRIEF_CONTRACT,
    candidateId: CANDIDATE_ID,
    businessDateKst: BUSINESS_DATE,
    sourceChannel: "instagram",
    targetChannels: ["instagram"],
    contentIntent: "informational",
    audience: "여행 준비를 시작하는 한국 여행객",
    coreMessage: "여행은 여유롭게 준비할수록 편해집니다.",
    factualClaims: [],
    evidenceRefs: [],
    cta: "출발 전에 공식 안내를 다시 확인하세요.",
    formats: {
      text: {
        enabled: true,
        title: "여유로운 여행 준비",
        body: "여행은 여유롭게 준비할수록 편해집니다.",
      },
      cardnews: { enabled: false, aspectRatio: null, cards: [], brandingIntent: null },
      shortform: {
        enabled: true,
        orientation: "vertical" as const,
        targetDurationRange: { minSeconds: 10, maxSeconds: 15 },
        narrationSegments: [
          {
            segmentId: "hook",
            narrationText: "여행은 여유롭게 준비할수록 편해집니다.",
            subtitleText: "여행은 여유롭게 준비할수록 편해집니다.",
            purpose: "hook",
            visualIntent: VISUAL_SUBJECT,
            evidenceRefs: [],
          },
        ],
        cta: "출발 전에 공식 안내를 다시 확인하세요.",
        voiceProfileId: "standard-ko-development",
      },
    },
    provenance: {
      builtFrom: "completed-marketing-candidate" as const,
      candidateContract: "completed-marketing-candidate-v1",
      assignmentId: handoff.contentAssignment.assignmentId,
      selectedAgendaId: handoff.selectedAgenda.id,
      governanceReviewId: governance.reviewId,
      evidenceRefIds: [],
    },
  };

  if (!isShortVideoBriefGenerationApplicable(mediaBrief as never)) {
    throw new Error("media brief not applicable");
  }

  writePackageArtifact({
    packageRoot,
    planned: {
      relativePath: MEDIA_BRIEF_RELATIVE_PATH,
      content: stableJsonBytes(mediaBrief),
      kind: "media_brief",
      origin: "media_brief",
      mediaType: "application/json",
    },
    createdAt: now.toISOString(),
  });

  writePackageArtifact({
    packageRoot,
    planned: {
      relativePath: DAILY_SHORTFORM_COMMITMENT_RELATIVE_PATH,
      content: stableJsonBytes({
        contract: DAILY_SHORTFORM_COMMITMENT_CONTRACT,
        businessDateKst: BUSINESS_DATE,
        candidateId: CANDIDATE_ID,
        shortformIntended: true,
        committedAt: now.toISOString(),
        reason: "cg3_canary",
      }),
      kind: "context",
      origin: "shortform_commitment",
      mediaType: "application/json",
    },
    createdAt: now.toISOString(),
  });

  const brief = buildShortVideoBrief({
    mediaBrief: mediaBrief as never,
    destinations: [],
    entities: [],
    durationPreset: "short",
  });
  // Force non-factual for canary so owned generic fixture is enqueue-valid.
  for (const scene of brief.scenes) {
    scene.visual.factualVisualRequired = false;
  }
  persistShortVideoBrief({ packageRoot, brief, createdAt: now.toISOString() });

  if (!existsSync(SOURCE_FIXTURE)) {
    throw new Error(`missing fixture: ${SOURCE_FIXTURE}`);
  }
  const absoluteManaged = join(assetRoot, ...MANAGED_RELATIVE_PATH.split("/"));
  mkdirSync(dirname(absoluteManaged), { recursive: true });
  if (!existsSync(absoluteManaged)) {
    copyFileSync(SOURCE_FIXTURE, absoluteManaged);
  }
  const sha256 = await sha256File(absoluteManaged);

  const catalog = await createMarketingMediaSourceCatalogRepository({ backend: "supabase" });
  const listed = await catalog.list({ status: "active", limit: 200 });
  let source =
    listed.find((row) => row.managedRelativePath === MANAGED_RELATIVE_PATH) ?? null;
  if (!source) {
    source = await catalog.registerSource({
      sourceKind: "own",
      mediaType: "video",
      rightsKind: "owned",
      managedRelativePath: MANAGED_RELATIVE_PATH,
      mimeType: "video/mp4",
      width: 480,
      height: 854,
      durationMs: 5056,
      orientation: "portrait",
      sha256,
      isPinned: true,
      metadata: {
        subject: VISUAL_SUBJECT,
        factualMatch: "confirmed",
        pickOrigin: "internal_catalog",
        tags: ["cg3", "canary"],
      },
      rightsNote: "CG-3 canary internal fixture",
    });
  } else {
    source = await catalog.updateSource({
      id: source.id,
      metadata: {
        ...source.metadata,
        factualMatch: "confirmed",
        pickOrigin: "internal_catalog",
      },
    });
  }

  const jobRepo = await createShortformVideoRenderJobRepository({ backend: "supabase" });
  const beforeJobs = await jobRepo.listForCandidate(CANDIDATE_ID);
  if (beforeJobs.some((j) => j.status === "QUEUED" || j.status === "RUNNING" || j.status === "READY")) {
    throw new Error(
      `candidate already has active/ready job(s): ${beforeJobs.map((j) => `${j.jobId}:${j.status}`).join(",")}`,
    );
  }

  const resolveDto = await resolveShortformSourcesForReview({ candidateId: CANDIDATE_ID });
  const pickResults: Array<Record<string, unknown>> = [];
  for (const scene of resolveDto.scenes) {
    const internal =
      scene.candidates.find(
        (c) => c.origin === "internal_catalog" && c.catalogSourceId === source!.id,
      ) ??
      scene.candidates.find((c) => c.origin === "internal_catalog") ??
      null;
    if (!internal) {
      throw new Error(`no internal candidate for ${scene.sceneId}`);
    }
    const picked = await pickShortformSourceForReview({
      candidateId: CANDIDATE_ID,
      sceneId: scene.sceneId,
      selectionToken: internal.selectionToken,
    });
    pickResults.push({
      sceneId: scene.sceneId,
      sourceId: picked.sourceId,
      renderEnqueue: picked.renderEnqueue ?? null,
    });
  }

  const afterJobs = await jobRepo.listForCandidate(CANDIDATE_ID);
  let job = afterJobs[0] ?? null;
  let statusAfter = job?.status ?? "none";
  let finalExists = false;
  let timerClaimed = false;

  if (job) {
    for (let i = 0; i < 30; i++) {
      await sleep(30_000);
      const refreshed = await jobRepo.getById(job.jobId);
      if (!refreshed) break;
      statusAfter = refreshed.status;
      if (refreshed.status === "RUNNING" || refreshed.claimedBy) timerClaimed = true;
      if (refreshed.status === "READY" || refreshed.status === "FAILED") {
        job = refreshed;
        break;
      }
      console.error(`[cg3-canary] poll ${i + 1}/30 status=${statusAfter}`);
    }
    finalExists = existsSync(join(packageRoot, SHORTFORM_FINAL_RELATIVE_PATH));
  }

  const evaluation = await evaluateShortformRenderReady({ candidateId: CANDIDATE_ID });
  const report = {
    candidateId: CANDIDATE_ID,
    packageRoot,
    beforeJobCount: beforeJobs.length,
    afterJobCount: afterJobs.length,
    automaticEnqueue: Boolean(
      pickResults.some((p) => (p.renderEnqueue as { enqueued?: boolean } | null)?.enqueued),
    ),
    jobId: job?.jobId ?? null,
    timerClaimed,
    statusAfter,
    finalArtifactExists: finalExists,
    adminArtifactVisiblePath: finalExists ? SHORTFORM_FINAL_RELATIVE_PATH : null,
    picks: pickResults,
    evaluation: {
      uiStatus: evaluation.uiStatus,
      renderReady: evaluation.renderReady,
      pickedSceneCount: evaluation.pickedSceneCount,
      requiredSceneCount: evaluation.requiredSceneCount,
    },
    errorSummary: job?.errorSummary ?? null,
    errorCode: job?.errorCode ?? null,
    externalPublication: false,
  };

  writeFileSync("/tmp/cg3-canary-report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (!job) process.exitCode = 2;
  else if (statusAfter === "FAILED") process.exitCode = 3;
  else if (statusAfter !== "READY" || !finalExists) process.exitCode = 4;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
