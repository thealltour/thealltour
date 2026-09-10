import { randomUUID } from "node:crypto";

import {
  DEFAULT_SHORTFORM_VIDEO_RENDER_LEASE_MS,
  DEFAULT_SHORTFORM_VIDEO_RENDER_MAX_ATTEMPTS,
  SHORTFORM_VIDEO_RENDER_JOB_CONTRACT,
  SHORTFORM_VIDEO_RENDER_PROFILE_V1,
  type ShortformVideoRenderInputSnapshot,
  type ShortformVideoRenderJob,
  type ShortformVideoRenderJobStatus,
} from "@/lib/marketing/assets/shortform/renderJob/contracts";
import { assertReadyRequiresDurableOutputPath } from "@/lib/marketing/assets/shortform/renderJob/cleanupOrdering";
import { ShortformVideoRenderJobError } from "@/lib/marketing/assets/shortform/renderJob/errors";
import {
  buildShortformVideoRenderLogicalRunKey,
  buildShortformVideoRenderSelectionHash,
  createShortformVideoRenderJobId,
} from "@/lib/marketing/assets/shortform/renderJob/logicalRunKey";
import type {
  ClaimShortformVideoRenderJobInput,
  ShortformVideoRenderJobOwnership,
  ShortformVideoRenderJobRepository,
} from "@/lib/marketing/assets/shortform/renderJob/repository";
import {
  sanitizeShortformVideoRenderErrorCode,
  sanitizeShortformVideoRenderErrorSummary,
} from "@/lib/marketing/assets/shortform/renderJob/sanitize";
import { SHORT_VIDEO_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/shortVideoBrief/paths";
import { SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH } from "@/lib/marketing/assets/shortform/resolver/paths";
import {
  assertShortformRenderEnqueueInput,
  type ShortformRenderSceneValidationInput,
} from "@/lib/marketing/assets/shortform/renderJob/validateEnqueue";

export function normalizeShortformVideoRenderJob(
  job: ShortformVideoRenderJob,
): ShortformVideoRenderJob {
  return {
    ...job,
    contract: SHORTFORM_VIDEO_RENDER_JOB_CONTRACT,
    productionRequestId: job.productionRequestId ?? null,
    sourceResolutionArtifactPath: job.sourceResolutionArtifactPath ?? null,
    renderProfile: SHORTFORM_VIDEO_RENDER_PROFILE_V1,
    claimedBy: job.claimedBy ?? null,
    claimedAt: job.claimedAt ?? null,
    leaseExpiresAt: job.leaseExpiresAt ?? null,
    claimToken: job.claimToken ?? null,
    nextAttemptAt: job.nextAttemptAt ?? null,
    outputArtifactPath: job.outputArtifactPath ?? null,
    errorCode: job.errorCode ?? null,
    errorSummary: job.errorSummary ?? null,
    completedAt: job.completedAt ?? null,
    maxAttempts: job.maxAttempts || DEFAULT_SHORTFORM_VIDEO_RENDER_MAX_ATTEMPTS,
    attemptCount: typeof job.attemptCount === "number" ? job.attemptCount : 0,
  };
}

export function ownershipFromShortformRenderClaim(
  job: ShortformVideoRenderJob,
): ShortformVideoRenderJobOwnership {
  if (!job.claimToken || !job.claimedBy) {
    throw new ShortformVideoRenderJobError("claim ownership missing", "CLAIM_OWNERSHIP_MISSING");
  }
  return {
    claimToken: job.claimToken,
    attemptCount: job.attemptCount,
    claimedBy: job.claimedBy,
  };
}

function ownershipMatches(
  job: ShortformVideoRenderJob,
  ownership: ShortformVideoRenderJobOwnership,
): boolean {
  return (
    job.status === "RUNNING" &&
    job.claimToken === ownership.claimToken &&
    job.attemptCount === ownership.attemptCount &&
    job.claimedBy === ownership.claimedBy
  );
}

export function isShortformRenderLeaseExpired(
  job: ShortformVideoRenderJob,
  now: Date,
): boolean {
  if (job.status !== "RUNNING") return false;
  if (!job.leaseExpiresAt) {
    // Fallback: treat missing lease as immediately stale for reclaim safety.
    return true;
  }
  const expires = Date.parse(job.leaseExpiresAt);
  if (!Number.isFinite(expires)) return true;
  return now.getTime() >= expires;
}

export function isShortformRenderClaimable(
  job: ShortformVideoRenderJob,
  now: Date,
): boolean {
  if (job.attemptCount >= job.maxAttempts) return false;
  if (job.status === "QUEUED") {
    if (!job.nextAttemptAt) return true;
    const next = Date.parse(job.nextAttemptAt);
    return !Number.isFinite(next) || now.getTime() >= next;
  }
  if (job.status === "RUNNING") {
    return isShortformRenderLeaseExpired(job, now) && job.attemptCount < job.maxAttempts;
  }
  return false;
}

export function buildShortformVideoRenderInputSnapshot(input: {
  briefContract: string;
  briefSha256: string;
  briefRelativePath?: string;
  resolutionContract?: string | null;
  resolutionSha256?: string | null;
  resolutionRelativePath?: string | null;
  scenePicks: ShortformVideoRenderInputSnapshot["scenePicks"];
  renderProfile?: typeof SHORTFORM_VIDEO_RENDER_PROFILE_V1;
}): ShortformVideoRenderInputSnapshot {
  const selectionHash = buildShortformVideoRenderSelectionHash(input.scenePicks);
  return {
    briefContract: input.briefContract,
    briefSha256: input.briefSha256.toLowerCase(),
    briefRelativePath: input.briefRelativePath ?? SHORT_VIDEO_BRIEF_RELATIVE_PATH,
    resolutionContract: input.resolutionContract ?? null,
    resolutionSha256: input.resolutionSha256?.toLowerCase() ?? null,
    resolutionRelativePath:
      input.resolutionRelativePath ??
      (input.resolutionSha256 ? SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH : null),
    selectionHash,
    scenePicks: [...input.scenePicks].sort((a, b) => a.sceneId.localeCompare(b.sceneId)),
    renderProfile: input.renderProfile ?? SHORTFORM_VIDEO_RENDER_PROFILE_V1,
  };
}

export function buildQueuedShortformVideoRenderJob(input: {
  candidateId: string;
  businessDateKst: string;
  productionRequestId?: string | null;
  snapshot: ShortformVideoRenderInputSnapshot;
  maxAttempts?: number;
  now?: Date;
}): ShortformVideoRenderJob {
  const now = input.now ?? new Date();
  const iso = now.toISOString();
  const logicalRunKey = buildShortformVideoRenderLogicalRunKey({
    candidateId: input.candidateId,
    briefSha256: input.snapshot.briefSha256,
    selectionHash: input.snapshot.selectionHash,
    renderProfile: input.snapshot.renderProfile,
  });
  const jobId = createShortformVideoRenderJobId(logicalRunKey);
  return normalizeShortformVideoRenderJob({
    contract: SHORTFORM_VIDEO_RENDER_JOB_CONTRACT,
    id: randomUUID(),
    jobId,
    logicalRunKey,
    candidateId: input.candidateId,
    productionRequestId: input.productionRequestId ?? null,
    businessDateKst: input.businessDateKst,
    status: "QUEUED",
    shortVideoBriefArtifactPath: input.snapshot.briefRelativePath,
    sourceResolutionArtifactPath: input.snapshot.resolutionRelativePath,
    renderProfile: SHORTFORM_VIDEO_RENDER_PROFILE_V1,
    inputSnapshot: input.snapshot,
    attemptCount: 0,
    maxAttempts: input.maxAttempts ?? DEFAULT_SHORTFORM_VIDEO_RENDER_MAX_ATTEMPTS,
    claimedBy: null,
    claimedAt: null,
    leaseExpiresAt: null,
    claimToken: null,
    nextAttemptAt: iso,
    outputArtifactPath: null,
    errorCode: null,
    errorSummary: null,
    createdAt: iso,
    updatedAt: iso,
    completedAt: null,
  });
}

/**
 * Explicit enqueue only — never auto-wire from candidate completion.
 */
export async function enqueueShortformVideoRenderJob(input: {
  repository: ShortformVideoRenderJobRepository;
  candidateId: string;
  businessDateKst: string;
  productionRequestId?: string | null;
  briefContract: string;
  briefSha256: string;
  scenes: ShortformRenderSceneValidationInput[];
  scenePicks: ShortformVideoRenderInputSnapshot["scenePicks"];
  resolutionContract?: string | null;
  resolutionSha256?: string | null;
  maxAttempts?: number;
  now?: Date;
}): Promise<{ job: ShortformVideoRenderJob; created: boolean }> {
  assertShortformRenderEnqueueInput({ scenes: input.scenes });

  const snapshot = buildShortformVideoRenderInputSnapshot({
    briefContract: input.briefContract,
    briefSha256: input.briefSha256,
    resolutionContract: input.resolutionContract,
    resolutionSha256: input.resolutionSha256,
    scenePicks: input.scenePicks,
  });

  const queued = buildQueuedShortformVideoRenderJob({
    candidateId: input.candidateId,
    businessDateKst: input.businessDateKst,
    productionRequestId: input.productionRequestId,
    snapshot,
    maxAttempts: input.maxAttempts,
    now: input.now,
  });

  return input.repository.enqueue(queued);
}

export function buildRequeuedShortformVideoRenderJob(
  existing: ShortformVideoRenderJob,
  now: Date = new Date(),
): ShortformVideoRenderJob {
  if (existing.status !== "FAILED") {
    throw new ShortformVideoRenderJobError(
      `requeue requires FAILED, got ${existing.status}`,
      "REQUEUE_REQUIRES_FAILED",
    );
  }
  const iso = now.toISOString();
  return normalizeShortformVideoRenderJob({
    ...existing,
    status: "QUEUED",
    updatedAt: iso,
    claimedBy: null,
    claimedAt: null,
    leaseExpiresAt: null,
    claimToken: null,
    nextAttemptAt: iso,
    completedAt: null,
    outputArtifactPath: null,
    errorCode: null,
    errorSummary: null,
    attemptCount: 0,
  });
}

const CANCELABLE: ShortformVideoRenderJobStatus[] = ["QUEUED", "FAILED"];

export function createInMemoryShortformVideoRenderJobRepository(): ShortformVideoRenderJobRepository {
  const byKey = new Map<string, ShortformVideoRenderJob>();
  const byId = new Map<string, string>();

  function getByLogical(logicalRunKey: string): ShortformVideoRenderJob | null {
    const row = byKey.get(logicalRunKey);
    return row ? normalizeShortformVideoRenderJob(structuredClone(row)) : null;
  }

  function set(job: ShortformVideoRenderJob): ShortformVideoRenderJob {
    const normalized = normalizeShortformVideoRenderJob(job);
    byKey.set(normalized.logicalRunKey, structuredClone(normalized));
    byId.set(normalized.id, normalized.logicalRunKey);
    byId.set(normalized.jobId, normalized.logicalRunKey);
    return getByLogical(normalized.logicalRunKey)!;
  }

  return {
    async getById(id) {
      const key = byId.get(id);
      if (!key) {
        // allow lookup by uuid id stored on row
        for (const row of byKey.values()) {
          if (row.id === id || row.jobId === id) {
            return normalizeShortformVideoRenderJob(structuredClone(row));
          }
        }
        return null;
      }
      return getByLogical(key);
    },
    async findByLogicalRunKey(logicalRunKey) {
      return getByLogical(logicalRunKey);
    },
    async listForCandidate(candidateId) {
      return [...byKey.values()]
        .map((row) => normalizeShortformVideoRenderJob(row))
        .filter((row) => row.candidateId === candidateId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async listQueued(options = {}) {
      const limit = options.limit ?? 50;
      return [...byKey.values()]
        .map((row) => normalizeShortformVideoRenderJob(row))
        .filter((row) => row.status === "QUEUED")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, limit);
    },
    async listClaimable(options = {}) {
      const limit = options.limit ?? 50;
      const now = options.now ?? new Date();
      return [...byKey.values()]
        .map((row) => normalizeShortformVideoRenderJob(row))
        .filter((row) => isShortformRenderClaimable(row, now))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, limit);
    },
    async enqueue(job) {
      const existing = getByLogical(job.logicalRunKey);
      if (existing) {
        return { job: existing, created: false };
      }
      return { job: set(normalizeShortformVideoRenderJob(job)), created: true };
    },
    async claimNext(input: ClaimShortformVideoRenderJobInput) {
      const workerId = input.workerId?.trim();
      if (!workerId) {
        throw new ShortformVideoRenderJobError("worker id required", "WORKER_ID_REQUIRED");
      }
      const now = input.now ?? new Date();
      const leaseMs = input.leaseMs ?? DEFAULT_SHORTFORM_VIDEO_RENDER_LEASE_MS;
      const iso = now.toISOString();
      const leaseExpiresAt = new Date(now.getTime() + leaseMs).toISOString();
      const claimToken = randomUUID();

      const candidates = [...byKey.values()]
        .map((row) => normalizeShortformVideoRenderJob(row))
        .filter((row) => isShortformRenderClaimable(row, now))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      for (const candidate of candidates) {
        const current = byKey.get(candidate.logicalRunKey);
        if (!current) continue;
        if (!isShortformRenderClaimable(current, now)) continue;
        const nextAttempt = (current.attemptCount ?? 0) + 1;
        if (nextAttempt > current.maxAttempts) continue;
        return set({
          ...normalizeShortformVideoRenderJob(current),
          status: "RUNNING",
          claimedBy: workerId,
          claimedAt: iso,
          leaseExpiresAt,
          claimToken,
          attemptCount: nextAttempt,
          nextAttemptAt: null,
          errorCode: null,
          errorSummary: null,
          completedAt: null,
          updatedAt: iso,
        });
      }
      return null;
    },
    async markReady(input) {
      const existing = getByLogical(input.logicalRunKey);
      if (!existing) return { ok: false, reason: "not_found", job: null };
      if (existing.status === "READY" || existing.status === "FAILED" || existing.status === "CANCELLED") {
        return { ok: false, reason: "terminal", job: existing };
      }
      if (existing.status !== "RUNNING") {
        return { ok: false, reason: "not_running", job: existing };
      }
      if (!ownershipMatches(existing, input.ownership)) {
        return { ok: false, reason: "ownership_lost", job: existing };
      }
      try {
        assertReadyRequiresDurableOutputPath(input.outputArtifactPath);
      } catch {
        return { ok: false, reason: "invalid_transition", job: existing };
      }
      const now = input.now ?? new Date();
      const iso = now.toISOString();
      return {
        ok: true,
        job: set({
          ...existing,
          status: "READY",
          outputArtifactPath: input.outputArtifactPath.trim(),
          completedAt: iso,
          errorCode: null,
          errorSummary: null,
          leaseExpiresAt: null,
          updatedAt: iso,
        }),
      };
    },
    async markFailed(input) {
      const existing = getByLogical(input.logicalRunKey);
      if (!existing) return { ok: false, reason: "not_found", job: null };
      if (existing.status === "READY" || existing.status === "FAILED" || existing.status === "CANCELLED") {
        return { ok: false, reason: "terminal", job: existing };
      }
      if (existing.status !== "RUNNING") {
        return { ok: false, reason: "not_running", job: existing };
      }
      if (!ownershipMatches(existing, input.ownership)) {
        return { ok: false, reason: "ownership_lost", job: existing };
      }
      const now = input.now ?? new Date();
      const iso = now.toISOString();
      return {
        ok: true,
        job: set({
          ...existing,
          status: "FAILED",
          completedAt: null,
          leaseExpiresAt: null,
          errorCode: sanitizeShortformVideoRenderErrorCode(input.errorCode ?? "RENDER_FAILED"),
          errorSummary: sanitizeShortformVideoRenderErrorSummary(input.error),
          updatedAt: iso,
        }),
      };
    },
    async requeueFailed(input) {
      const existing = getByLogical(input.logicalRunKey);
      if (!existing) {
        throw new ShortformVideoRenderJobError("job not found", "NOT_FOUND");
      }
      return set(buildRequeuedShortformVideoRenderJob(existing, input.now ?? new Date()));
    },
    async cancel(input) {
      const existing = getByLogical(input.logicalRunKey);
      if (!existing) {
        throw new ShortformVideoRenderJobError("job not found", "NOT_FOUND");
      }
      if (!CANCELABLE.includes(existing.status)) {
        throw new ShortformVideoRenderJobError(
          `cannot cancel from ${existing.status}`,
          "INVALID_TRANSITION",
        );
      }
      const iso = (input.now ?? new Date()).toISOString();
      return set({
        ...existing,
        status: "CANCELLED",
        claimedBy: null,
        claimedAt: null,
        leaseExpiresAt: null,
        claimToken: null,
        updatedAt: iso,
      });
    },
  };
}
