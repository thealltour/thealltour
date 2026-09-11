#!/usr/bin/env node
/**
 * SV-8C3-A ops one-shot: prepare ONE shortform candidate through
 * MediaBrief → ShortVideoBrief → Resolve → Explicit Pick (internal_catalog).
 * Does NOT enqueue RenderJob, enable worker, TTS, Remotion, or provider download.
 *
 *   npx tsx scripts/prepare-sv8c3a-first-e2e-candidate.ts
 */
import { createRequire } from "node:module";
import { copyFileSync, createReadStream, existsSync, mkdirSync } from "node:fs";
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

const CANDIDATE_ID = "cmc_sv8c3a_first_e2e";
const BUSINESS_DATE = "2026-09-11";
const ROUTINE_ID = "sv8c3a-first-e2e";
const PURPOSE = "sv8c3a-first-e2e-candidate-prep";
const MANAGED_RELATIVE_PATH = "source/own/sv8c3a-first-e2e.mp4";
const SOURCE_FIXTURE =
  "/mnt/HDD2TB/marketing-assets/2026/09/03/dev-tts-a6-verification/reel/incoming/shot-0001.mp4";
const VISUAL_SUBJECT = "travel lifestyle city walk";

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

async function main() {
  const { prepareManagerToContentHandoff } = await import(
    "@/lib/marketing/content/prepareManagerToContentHandoff"
  );
  const { mapManagerEvidenceRef } = await import("@/lib/marketing/content/evidence");
  const { officialEvidence, PRODUCT } = await import(
    "@/lib/marketing/cron/daily/__tests__/fixtures"
  );
  const {
    DAILY_MARKETING_RUN_CONTRACT,
    COMPLETED_MARKETING_CANDIDATE_CONTRACT,
  } = await import("@/lib/marketing/cron/daily/types");
  const { GOVERNANCE_DECISION_CONTRACT } = await import(
    "@/lib/marketing/content/governance/types"
  );
  const { buildLogicalDailyRunKey } = await import(
    "@/lib/marketing/cron/daily/kstBusinessDate"
  );
  const { createDailyMarketingRunRepository } = await import(
    "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository"
  );
  const { resolveMarketingAssetRoot } = await import("@/lib/marketing/assets/config");
  const { ensurePackageLayout, resolvePackageDirectory } = await import(
    "@/lib/marketing/assets/paths"
  );
  const { MEDIA_BRIEF_CONTRACT } = await import("@/lib/marketing/assets/contracts");
  const { MEDIA_BRIEF_RELATIVE_PATH } = await import("@/lib/marketing/assets/video/paths");
  const { stableJsonBytes } = await import("@/lib/marketing/assets/hashing");
  const { writePackageArtifact } = await import("@/lib/marketing/assets/writeArtifact");
  const { buildShortVideoBrief } = await import(
    "@/lib/marketing/assets/shortVideoBrief/buildShortVideoBrief"
  );
  const { persistShortVideoBrief } = await import(
    "@/lib/marketing/assets/shortVideoBrief/persist"
  );
  const { isShortVideoBriefGenerationApplicable } = await import(
    "@/lib/marketing/assets/shortVideoBrief/gating"
  );
  const { createMarketingMediaSourceCatalogRepository } = await import(
    "@/lib/marketing/assets/sourceCatalog/createSourceCatalogRepository"
  );
  const {
    resolveShortformSourcesForReview,
    pickShortformSourceForReview,
  } = await import("@/lib/marketing/assets/shortform/review/service");
  const { createClient } = await import("@supabase/supabase-js");

  const now = new Date();
  const logicalRunKey = buildLogicalDailyRunKey({
    routineId: ROUTINE_ID,
    businessDateKst: BUSINESS_DATE,
  });
  const runId = `run_${PURPOSE}`;

  const handoff = prepareManagerToContentHandoff(
    {
      title: "[SV8C3A] First live shortform E2E candidate",
      summary: "Isolated first-E2E shortform candidate using internal managed asset only.",
      rationale: ["sv8c3a-prep", "internal_catalog-first", "no-render-job"],
      agendaCandidateId: "ac-sv8c3a",
      researchBriefId: "rb-sv8c3a",
      researchScoreAtSelection: 0.7,
      evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.8)],
      matchedProductIds: [],
      idempotencyKey: logicalRunKey,
      constraints: ["verification-only", "no-auto-publish", "sv8c3a"],
    },
    { now },
  );

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
    runId,
    logicalRunKey,
    businessDateKst: BUSINESS_DATE,
    correlationId: `sv8c3a:${PURPOSE}`,
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

  const run = {
    contract: DAILY_MARKETING_RUN_CONTRACT,
    runId,
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
    degraded: false,
    observability,
    metadata: { purpose: PURPOSE, productId: PRODUCT, verification: true, sv8c3a: true },
  };

  const draft = {
    title: "[SV8C3A] Travel shortform E2E",
    body: "여행은 여유롭게 준비할수록 편해집니다. 내부 테스트용 shortform 후보입니다.",
    channel: "instagram",
    agenda: handoff.selectedAgenda.title,
    sourceReferences: ["evidence:ev-official"],
    assignmentId: handoff.contentAssignment.assignmentId,
    contentPlan: handoff.contentPlanScaffold,
  };

  const candidate = {
    contract: COMPLETED_MARKETING_CANDIDATE_CONTRACT,
    candidateId: CANDIDATE_ID,
    runId,
    logicalRunKey,
    businessDateKst: BUSINESS_DATE,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    selectedAgenda: handoff.selectedAgenda,
    contentAssignment: handoff.contentAssignment,
    contentPlan: handoff.contentPlanScaffold,
    draft,
    governanceDecision: governance,
    status: "ready_for_human_review" as const,
    revisionHistory: [{ revisionNumber: 0, governanceDecision: "ALLOW" }],
    provenance: {
      routineId: ROUTINE_ID,
      correlationId: run.correlationId,
      researchStatus: "ok",
      governanceReviewId: governance.reviewId,
    },
    observability,
  };

  const repo = await createDailyMarketingRunRepository({ backend: "supabase" });
  const existing = await repo.findCandidateByCandidateId(CANDIDATE_ID);
  if (!existing) {
    await repo.saveRun(run as never);
    await repo.saveCandidate(candidate as never);
  }

  const assetRoot = resolveMarketingAssetRoot({ env: process.env, required: true });
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
      cardnews: {
        enabled: false,
        aspectRatio: null,
        cards: [],
        brandingIntent: null,
      },
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
    throw new Error("media brief not applicable for ShortVideoBrief");
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

  const brief = buildShortVideoBrief({
    mediaBrief: mediaBrief as never,
    destinations: [],
    entities: [],
    durationPreset: "short",
  });
  const briefPersist = persistShortVideoBrief({
    packageRoot,
    brief,
    createdAt: now.toISOString(),
  });

  if (!existsSync(SOURCE_FIXTURE)) {
    throw new Error(`missing internal fixture video: ${SOURCE_FIXTURE}`);
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
        tags: ["travel", "lifestyle", "city", "walk", "sv8c3a", "first-e2e"],
        purpose: PURPOSE,
      },
      rightsNote: "Internal TheAllTour test asset copied from owned verification fixture",
    });
  }

  const resolveDto = await resolveShortformSourcesForReview({ candidateId: CANDIDATE_ID });
  const pickResults: Array<{ sceneId: string; sourceId: string; origin: string }> = [];
  for (const scene of resolveDto.scenes) {
    const internal =
      scene.candidates.find(
        (c) => c.origin === "internal_catalog" && c.catalogSourceId === source!.id,
      ) ??
      scene.candidates.find((c) => c.origin === "internal_catalog") ??
      null;
    if (!internal) {
      throw new Error(
        `no internal_catalog candidate for ${scene.sceneId}; attempted=${JSON.stringify(scene.attemptedSources)}`,
      );
    }
    const picked = await pickShortformSourceForReview({
      candidateId: CANDIDATE_ID,
      sceneId: scene.sceneId,
      selectionToken: internal.selectionToken,
    });
    pickResults.push({
      sceneId: scene.sceneId,
      sourceId: picked.sourceId,
      origin: "internal_catalog",
    });
  }

  const usages = await catalog.listUsagesForCandidate(CANDIDATE_ID);
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { count: jobCount } = await sb
    .from("shortform_video_render_jobs")
    .select("*", { count: "exact", head: true });

  console.log(
    JSON.stringify(
      {
        action: existing ? "reused_candidate_row" : "seeded_candidate_row",
        candidateId: CANDIDATE_ID,
        briefArtifact: "context/short-video-brief.json",
        briefContract: brief.contract,
        briefCandidateId: brief.candidateId,
        packageRoot,
        briefPersistStatus: briefPersist.status,
        sceneCount: brief.scenes.length,
        sceneIds: brief.scenes.map((s) => s.sceneId),
        sourceId: source.id,
        sourceKind: source.sourceKind,
        managedRelativePath: source.managedRelativePath,
        origin: "internal_catalog",
        picks: pickResults,
        usageCount: usages.length,
        renderJobs: jobCount ?? 0,
        factualFlags: brief.scenes.map((s) => ({
          sceneId: s.sceneId,
          factualVisualRequired: s.visual.factualVisualRequired,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
