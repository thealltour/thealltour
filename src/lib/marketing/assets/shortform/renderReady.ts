/**
 * CG-3 — Render-ready predicate + automatic enqueue after explicit human PICK.
 *
 * Does NOT: auto-PICK, auto-approve, publish, or invoke the Mini-PC worker.
 */

import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";

import { readCandidateAssetPackageFile } from "@/lib/marketing/assets/candidateAssetPackageService";
import { resolveMarketingAssetRoot, type MarketingAssetEnv } from "@/lib/marketing/assets/config";
import { sha256Buffer } from "@/lib/marketing/assets/hashing";
import { resolvePackageDirectory } from "@/lib/marketing/assets/paths";
import { SHORTFORM_FINAL_RELATIVE_PATH } from "@/lib/marketing/assets/shortform/production/paths";
import {
  DAILY_SHORTFORM_COMMITMENT_CONTRACT,
  DAILY_SHORTFORM_COMMITMENT_RELATIVE_PATH,
  type DailyShortformCommitment,
} from "@/lib/marketing/assets/shortform/dailyShortformBridge";
import {
  SHORTFORM_SOURCE_RESOLUTION_CONTRACT,
  type ShortformSourceResolutionPlan,
} from "@/lib/marketing/assets/shortform/resolver/contracts";
import { SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH } from "@/lib/marketing/assets/shortform/resolver/paths";
import {
  type ShortformVideoRenderJob,
  type ShortformVideoRenderScenePickSnapshot,
} from "@/lib/marketing/assets/shortform/renderJob/contracts";
import type { ShortformVideoRenderJobRepository } from "@/lib/marketing/assets/shortform/renderJob/repository";
import { createShortformVideoRenderJobRepository } from "@/lib/marketing/assets/shortform/renderJob/createRepository";
import { enqueueShortformVideoRenderJob } from "@/lib/marketing/assets/shortform/renderJob/inMemoryRepository";
import {
  validateShortformRenderEnqueueInput,
  type ShortformRenderSceneValidationInput,
  type ShortformRenderabilityIssue,
} from "@/lib/marketing/assets/shortform/renderJob/validateEnqueue";
import { createMarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/createSourceCatalogRepository";
import type { MarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/repository";
import type { MarketingMediaSourceRecord } from "@/lib/marketing/assets/sourceCatalog/types";
import { SHORT_VIDEO_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/shortVideoBrief/paths";
import type { ShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/contracts";
import { parseShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/validate";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";

export type ShortformRenderUiStatus =
  | "not_shortform"
  | "not_render_ready"
  | "queued"
  | "running"
  | "ready"
  | "failed"
  | "cancelled";

export type ShortformRenderReadyEvaluation = {
  shortformIntended: boolean;
  renderReady: boolean;
  uiStatus: ShortformRenderUiStatus;
  reason: string;
  issues: ShortformRenderabilityIssue[];
  requiredSceneCount: number;
  pickedSceneCount: number;
  brief: ShortVideoBrief | null;
  job: ShortformVideoRenderJob | null;
  finalArtifactExists: boolean;
  finalRelativePath: typeof SHORTFORM_FINAL_RELATIVE_PATH;
  packageRoot: string | null;
};

export type MaybeEnqueueAfterPickResult = {
  evaluation: ShortformRenderReadyEvaluation;
  enqueued: boolean;
  created: boolean;
  job: ShortformVideoRenderJob | null;
  skippedReason?: string;
};

function tryParseJson(bytes: Buffer): unknown {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    return null;
  }
}

async function readPackageJson(
  candidateId: string,
  relativePath: string,
  repository?: DailyMarketingRunRepository,
): Promise<{ ok: true; json: unknown; absolutePath: string; businessDateKst: string } | { ok: false }> {
  try {
    const result = await readCandidateAssetPackageFile({
      candidateId,
      relativePath,
      repository,
    });
    if (!result.ok) return { ok: false };
    return {
      ok: true,
      json: tryParseJson(result.file.bytes),
      absolutePath: result.file.absolutePath,
      businessDateKst: result.file.businessDateKst,
    };
  } catch {
    return { ok: false };
  }
}

export function isShortformCommitmentPayload(value: unknown): value is DailyShortformCommitment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    record.contract === DAILY_SHORTFORM_COMMITMENT_CONTRACT &&
    record.shortformIntended === true &&
    typeof record.candidateId === "string"
  );
}

export function candidateLooksShortformIntended(candidate: CompletedMarketingCandidate): boolean {
  const formats = [
    ...(candidate.contentPlan?.recommendedFormats ?? []),
    ...(candidate.contentAssignment.formatHints ?? []),
  ];
  return formats.some((item) => item.format === "short_video_concept");
}

export async function detectShortformIntended(input: {
  candidateId: string;
  candidate?: CompletedMarketingCandidate | null;
  repository?: DailyMarketingRunRepository;
}): Promise<{ shortformIntended: boolean; reason: string }> {
  const commitment = await readPackageJson(
    input.candidateId,
    DAILY_SHORTFORM_COMMITMENT_RELATIVE_PATH,
    input.repository,
  );
  if (commitment.ok && isShortformCommitmentPayload(commitment.json)) {
    if (commitment.json.candidateId === input.candidateId) {
      return { shortformIntended: true, reason: "commitment_artifact" };
    }
  }

  const briefFile = await readPackageJson(
    input.candidateId,
    SHORT_VIDEO_BRIEF_RELATIVE_PATH,
    input.repository,
  );
  if (briefFile.ok) {
    try {
      const brief = parseShortVideoBrief(briefFile.json);
      if (brief.candidateId === input.candidateId) {
        return { shortformIntended: true, reason: "short_video_brief_present" };
      }
    } catch {
      /* ignore invalid brief */
    }
  }

  // Soft formatHints alone do not gate final approval — only durable shortform artifacts do.
  return { shortformIntended: false, reason: "not_shortform_intended" };
}

function originFromSource(source: MarketingMediaSourceRecord): string {
  const metaOrigin = source.metadata?.pickOrigin;
  if (typeof metaOrigin === "string" && metaOrigin.trim()) return metaOrigin.trim();
  if (source.sourceKind === "pexels") return "pexels";
  if (source.sourceKind === "pixabay") return "pixabay";
  if (
    source.sourceKind === "own" ||
    source.sourceKind === "partner" ||
    source.storageClass === "managed_local"
  ) {
    return "internal_catalog";
  }
  return source.sourceKind;
}

function factualMatchFromSource(
  source: MarketingMediaSourceRecord,
  resolution: ShortformSourceResolutionPlan | null,
  sceneId: string,
): string {
  const meta = source.metadata?.factualMatch;
  if (typeof meta === "string" && meta.trim()) return meta.trim();

  if (resolution) {
    const scene = resolution.scenes.find((item) => item.sceneId === sceneId);
    const hit =
      scene?.candidates.find((c) => c.catalogSourceId === source.id) ??
      scene?.candidates.find(
        (c) =>
          c.provider === source.provider &&
          c.providerAssetId === source.providerAssetId &&
          Boolean(source.providerAssetId),
      ) ??
      (scene?.recommendedCandidate &&
      (scene.recommendedCandidate.catalogSourceId === source.id ||
        (scene.recommendedCandidate.provider === source.provider &&
          scene.recommendedCandidate.providerAssetId === source.providerAssetId))
        ? scene.recommendedCandidate
        : null);
    if (hit?.factualMatch) return hit.factualMatch;
  }

  if (source.rightsKind === "owned" || source.rightsKind === "partner_authorized") {
    return "confirmed";
  }
  return "unknown";
}

export async function buildScenePickSnapshots(input: {
  candidateId: string;
  brief: ShortVideoBrief;
  catalog: MarketingMediaSourceCatalogRepository;
  resolution?: ShortformSourceResolutionPlan | null;
}): Promise<{
  scenes: ShortformRenderSceneValidationInput[];
  scenePicks: ShortformVideoRenderScenePickSnapshot[];
  pickedSceneCount: number;
}> {
  const usages = await input.catalog.listUsagesForCandidate(input.candidateId);
  const usageByScene = new Map<string, (typeof usages)[number]>();
  for (const usage of usages) {
    if (!usage.sceneKey) continue;
    if (!usageByScene.has(usage.sceneKey)) usageByScene.set(usage.sceneKey, usage);
  }

  const scenes: ShortformRenderSceneValidationInput[] = [];
  const scenePicks: ShortformVideoRenderScenePickSnapshot[] = [];
  let pickedSceneCount = 0;

  for (const scene of input.brief.scenes) {
    const usage = usageByScene.get(scene.sceneId);
    if (!usage) {
      scenes.push({
        sceneId: scene.sceneId,
        factualVisualRequired: scene.visual.factualVisualRequired,
        generatedVideoAllowed: scene.visual.generatedVideoAllowed,
        pick: null,
      });
      continue;
    }

    const source = await input.catalog.getById(usage.sourceId);
    if (!source) {
      scenes.push({
        sceneId: scene.sceneId,
        factualVisualRequired: scene.visual.factualVisualRequired,
        generatedVideoAllowed: scene.visual.generatedVideoAllowed,
        pick: null,
      });
      continue;
    }

    const factualMatch = factualMatchFromSource(source, input.resolution ?? null, scene.sceneId);
    const origin = originFromSource(source);
    pickedSceneCount += 1;
    scenes.push({
      sceneId: scene.sceneId,
      factualVisualRequired: scene.visual.factualVisualRequired,
      generatedVideoAllowed: scene.visual.generatedVideoAllowed,
      pick: {
        sourceId: source.id,
        rightsKind: source.rightsKind,
        factualMatch,
        origin,
        mediaType: source.mediaType,
      },
    });
    scenePicks.push({
      sceneId: scene.sceneId,
      sourceId: source.id,
      origin,
      rightsKind: source.rightsKind,
      factualMatch,
      mediaType: source.mediaType,
    });
  }

  return { scenes, scenePicks, pickedSceneCount };
}

function mapJobToUiStatus(job: ShortformVideoRenderJob | null): ShortformRenderUiStatus {
  if (!job) return "not_render_ready";
  switch (job.status) {
    case "QUEUED":
      return "queued";
    case "RUNNING":
      return "running";
    case "READY":
      return "ready";
    case "FAILED":
      return "failed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "not_render_ready";
  }
}

function selectPrimaryJob(jobs: ShortformVideoRenderJob[]): ShortformVideoRenderJob | null {
  if (jobs.length === 0) return null;
  const rank: Record<string, number> = {
    RUNNING: 0,
    QUEUED: 1,
    READY: 2,
    FAILED: 3,
    CANCELLED: 4,
  };
  return [...jobs].sort((a, b) => {
    const ra = rank[a.status] ?? 9;
    const rb = rank[b.status] ?? 9;
    if (ra !== rb) return ra - rb;
    return b.updatedAt.localeCompare(a.updatedAt);
  })[0]!;
}

export function finalArtifactExistsOnDisk(input: {
  packageRoot: string | null;
  job?: ShortformVideoRenderJob | null;
}): boolean {
  if (!input.packageRoot) return false;
  const relative =
    input.job?.outputArtifactPath?.trim() || SHORTFORM_FINAL_RELATIVE_PATH;
  return existsSync(join(input.packageRoot, relative));
}

export async function evaluateShortformRenderReady(input: {
  candidateId: string;
  candidate?: CompletedMarketingCandidate | null;
  catalog?: MarketingMediaSourceCatalogRepository;
  jobRepository?: ShortformVideoRenderJobRepository;
  repository?: DailyMarketingRunRepository;
  env?: MarketingAssetEnv;
  now?: Date;
}): Promise<ShortformRenderReadyEvaluation> {
  const intended = await detectShortformIntended({
    candidateId: input.candidateId,
    candidate: input.candidate,
    repository: input.repository,
  });

  const empty: ShortformRenderReadyEvaluation = {
    shortformIntended: intended.shortformIntended,
    renderReady: false,
    uiStatus: intended.shortformIntended ? "not_render_ready" : "not_shortform",
    reason: intended.reason,
    issues: [],
    requiredSceneCount: 0,
    pickedSceneCount: 0,
    brief: null,
    job: null,
    finalArtifactExists: false,
    finalRelativePath: SHORTFORM_FINAL_RELATIVE_PATH,
    packageRoot: null,
  };

  if (!intended.shortformIntended) return empty;

  const briefFile = await readPackageJson(
    input.candidateId,
    SHORT_VIDEO_BRIEF_RELATIVE_PATH,
    input.repository,
  );
  if (!briefFile.ok) {
    return { ...empty, reason: "short_video_brief_missing" };
  }

  let brief: ShortVideoBrief;
  try {
    brief = parseShortVideoBrief(briefFile.json);
  } catch {
    return { ...empty, reason: "short_video_brief_invalid" };
  }
  if (brief.candidateId !== input.candidateId) {
    return { ...empty, reason: "short_video_brief_mismatch" };
  }

  const packageRoot = briefFile.absolutePath.replace(/[/\\][^/\\]+[/\\][^/\\]+$/, "");
  const catalog =
    input.catalog ??
    (await createMarketingMediaSourceCatalogRepository({ env: input.env }));
  const jobRepo =
    input.jobRepository ??
    (await createShortformVideoRenderJobRepository({ env: input.env }));

  let resolution: ShortformSourceResolutionPlan | null = null;
  const resolutionFile = await readPackageJson(
    input.candidateId,
    SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH,
    input.repository,
  );
  if (
    resolutionFile.ok &&
    resolutionFile.json &&
    typeof resolutionFile.json === "object" &&
    (resolutionFile.json as { contract?: unknown }).contract ===
      SHORTFORM_SOURCE_RESOLUTION_CONTRACT
  ) {
    resolution = resolutionFile.json as ShortformSourceResolutionPlan;
  }

  const { scenes, scenePicks, pickedSceneCount } = await buildScenePickSnapshots({
    candidateId: input.candidateId,
    brief,
    catalog,
    resolution,
  });

  const validation = validateShortformRenderEnqueueInput({ scenes });
  const jobs = await jobRepo.listForCandidate(input.candidateId);
  const job = selectPrimaryJob(jobs);
  const finalArtifactExists = finalArtifactExistsOnDisk({ packageRoot, job });

  if (!validation.ok) {
    return {
      shortformIntended: true,
      renderReady: false,
      uiStatus: job ? mapJobToUiStatus(job) : "not_render_ready",
      reason: validation.issues[0]?.code ?? "not_render_ready",
      issues: validation.issues,
      requiredSceneCount: brief.scenes.length,
      pickedSceneCount,
      brief,
      job,
      finalArtifactExists,
      finalRelativePath: SHORTFORM_FINAL_RELATIVE_PATH,
      packageRoot,
    };
  }

  // All scenes picked + validation ok.
  const uiStatus = job ? mapJobToUiStatus(job) : "not_render_ready";
  return {
    shortformIntended: true,
    renderReady: true,
    uiStatus: job ? uiStatus : "not_render_ready",
    reason: job ? `job_${job.status.toLowerCase()}` : "render_ready_no_job",
    issues: [],
    requiredSceneCount: brief.scenes.length,
    pickedSceneCount,
    brief,
    job,
    finalArtifactExists,
    finalRelativePath: SHORTFORM_FINAL_RELATIVE_PATH,
    packageRoot,
    // scenePicks retained via closure for enqueue helper — callers rebuild
  };
}

/**
 * After an explicit durable PICK, enqueue exactly one RenderJob when all scenes are ready.
 * Idempotent: existing equivalent QUEUED/RUNNING/READY/FAILED job is reused (no silent replace).
 */
export async function maybeEnqueueShortformRenderAfterPick(input: {
  candidateId: string;
  candidate?: CompletedMarketingCandidate | null;
  catalog?: MarketingMediaSourceCatalogRepository;
  jobRepository?: ShortformVideoRenderJobRepository;
  repository?: DailyMarketingRunRepository;
  env?: MarketingAssetEnv;
  now?: Date;
}): Promise<MaybeEnqueueAfterPickResult> {
  const catalog =
    input.catalog ??
    (await createMarketingMediaSourceCatalogRepository({ env: input.env }));
  const jobRepository =
    input.jobRepository ??
    (await createShortformVideoRenderJobRepository({ env: input.env }));

  const evaluation = await evaluateShortformRenderReady({
    ...input,
    catalog,
    jobRepository,
  });

  if (!evaluation.shortformIntended) {
    return {
      evaluation,
      enqueued: false,
      created: false,
      job: null,
      skippedReason: evaluation.reason,
    };
  }

  if (!evaluation.renderReady || !evaluation.brief || !evaluation.packageRoot) {
    return {
      evaluation,
      enqueued: false,
      created: false,
      job: evaluation.job,
      skippedReason: evaluation.reason,
    };
  }

  const briefFile = await readPackageJson(
    input.candidateId,
    SHORT_VIDEO_BRIEF_RELATIVE_PATH,
    input.repository,
  );
  if (!briefFile.ok) {
    return {
      evaluation,
      enqueued: false,
      created: false,
      job: evaluation.job,
      skippedReason: "short_video_brief_missing",
    };
  }

  let resolutionContract: string | null = null;
  let resolutionSha256: string | null = null;
  const resolutionFile = await readPackageJson(
    input.candidateId,
    SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH,
    input.repository,
  );
  let resolution: ShortformSourceResolutionPlan | null = null;
  if (resolutionFile.ok && resolutionFile.json) {
    try {
      const raw = await readCandidateAssetPackageFile({
        candidateId: input.candidateId,
        relativePath: SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH,
        repository: input.repository,
      });
      if (raw.ok) {
        resolutionSha256 = sha256Buffer(raw.file.bytes);
        resolutionContract = SHORTFORM_SOURCE_RESOLUTION_CONTRACT;
      }
    } catch {
      /* optional resolution */
    }
    if (
      typeof resolutionFile.json === "object" &&
      (resolutionFile.json as { contract?: unknown }).contract ===
        SHORTFORM_SOURCE_RESOLUTION_CONTRACT
    ) {
      resolution = resolutionFile.json as ShortformSourceResolutionPlan;
    }
  }

  const { scenes, scenePicks } = await buildScenePickSnapshots({
    candidateId: input.candidateId,
    brief: evaluation.brief,
    catalog,
    resolution,
  });

  const briefBytes = await readCandidateAssetPackageFile({
    candidateId: input.candidateId,
    relativePath: SHORT_VIDEO_BRIEF_RELATIVE_PATH,
    repository: input.repository,
  });
  if (!briefBytes.ok) {
    return {
      evaluation,
      enqueued: false,
      created: false,
      job: evaluation.job,
      skippedReason: "short_video_brief_missing",
    };
  }

  const result = await enqueueShortformVideoRenderJob({
    repository: jobRepository,
    candidateId: input.candidateId,
    businessDateKst: briefFile.businessDateKst,
    briefContract: evaluation.brief.contract,
    briefSha256: sha256Buffer(briefBytes.file.bytes),
    scenes,
    scenePicks,
    resolutionContract,
    resolutionSha256,
    now: input.now,
  });

  // Equivalent FAILED job: do not silently replace — operator must requeue.
  if (result.job.status === "FAILED" && !result.created) {
    return {
      evaluation: {
        ...evaluation,
        uiStatus: "failed",
        job: result.job,
        reason: "failed_requires_requeue",
        finalArtifactExists: false,
      },
      enqueued: false,
      created: false,
      job: result.job,
      skippedReason: "failed_requires_requeue",
    };
  }

  const uiStatus = mapJobToUiStatus(result.job);
  return {
    evaluation: {
      ...evaluation,
      uiStatus,
      job: result.job,
      reason: result.created ? "enqueued" : `reused_${result.job.status.toLowerCase()}`,
      finalArtifactExists: finalArtifactExistsOnDisk({
        packageRoot: evaluation.packageRoot,
        job: result.job,
      }),
    },
    enqueued: true,
    created: result.created,
    job: result.job,
  };
}

/**
 * Public alias matching the CG-3 naming: isShortformRenderReady(candidate).
 */
export async function isShortformRenderReady(input: {
  candidateId: string;
  candidate?: CompletedMarketingCandidate | null;
  catalog?: MarketingMediaSourceCatalogRepository;
  jobRepository?: ShortformVideoRenderJobRepository;
  repository?: DailyMarketingRunRepository;
  env?: MarketingAssetEnv;
}): Promise<boolean> {
  const evaluation = await evaluateShortformRenderReady(input);
  return evaluation.renderReady;
}

export function resolveCandidatePackageRootFromParts(input: {
  candidateId: string;
  businessDateKst: string;
  env?: MarketingAssetEnv;
}): string {
  const assetRoot = resolveMarketingAssetRoot({ env: input.env });
  return resolvePackageDirectory({
    assetRoot,
    businessDateKst: input.businessDateKst,
    candidateId: input.candidateId,
  });
}
