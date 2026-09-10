import "server-only";

import {
  DEFAULT_SHORTFORM_VIDEO_RENDER_LEASE_MS,
  SHORTFORM_VIDEO_RENDER_JOB_CONTRACT,
  SHORTFORM_VIDEO_RENDER_PROFILE_V1,
  type ShortformVideoRenderInputSnapshot,
  type ShortformVideoRenderJob,
  type ShortformVideoRenderJobStatus,
} from "@/lib/marketing/assets/shortform/renderJob/contracts";
import { ShortformVideoRenderJobError } from "@/lib/marketing/assets/shortform/renderJob/errors";
import {
  buildRequeuedShortformVideoRenderJob,
  isShortformRenderClaimable,
  normalizeShortformVideoRenderJob,
} from "@/lib/marketing/assets/shortform/renderJob/inMemoryRepository";
import type {
  ClaimShortformVideoRenderJobInput,
  ShortformVideoRenderJobOwnership,
  ShortformVideoRenderJobRepository,
} from "@/lib/marketing/assets/shortform/renderJob/repository";
import {
  sanitizeShortformVideoRenderErrorCode,
  sanitizeShortformVideoRenderErrorSummary,
} from "@/lib/marketing/assets/shortform/renderJob/sanitize";

type DbClient = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

const TABLE = "shortform_video_render_jobs";

function asRow(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ShortformVideoRenderJobError("expected single row", "MALFORMED_ROW");
  }
  return data as Record<string, unknown>;
}

function mapJobRow(value: unknown): ShortformVideoRenderJob {
  const row = asRow(value);
  return normalizeShortformVideoRenderJob({
    contract: SHORTFORM_VIDEO_RENDER_JOB_CONTRACT,
    id: String(row.id),
    jobId: String(row.job_id),
    logicalRunKey: String(row.logical_run_key),
    candidateId: String(row.candidate_id),
    productionRequestId: row.production_request_id == null ? null : String(row.production_request_id),
    businessDateKst: String(row.business_date_kst),
    status: row.status as ShortformVideoRenderJobStatus,
    shortVideoBriefArtifactPath: String(row.short_video_brief_artifact_path),
    sourceResolutionArtifactPath:
      row.source_resolution_artifact_path == null
        ? null
        : String(row.source_resolution_artifact_path),
    renderProfile: SHORTFORM_VIDEO_RENDER_PROFILE_V1,
    inputSnapshot: row.input_snapshot as ShortformVideoRenderInputSnapshot,
    attemptCount: Number(row.attempt_count ?? 0),
    maxAttempts: Number(row.max_attempts ?? 3),
    claimedBy: row.claimed_by == null ? null : String(row.claimed_by),
    claimedAt: row.claimed_at == null ? null : String(row.claimed_at),
    leaseExpiresAt: row.lease_expires_at == null ? null : String(row.lease_expires_at),
    claimToken: row.claim_token == null ? null : String(row.claim_token),
    nextAttemptAt: row.next_attempt_at == null ? null : String(row.next_attempt_at),
    outputArtifactPath: row.output_artifact_path == null ? null : String(row.output_artifact_path),
    errorCode: row.error_code == null ? null : String(row.error_code),
    errorSummary: row.error_summary == null ? null : String(row.error_summary),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: row.completed_at == null ? null : String(row.completed_at),
  });
}

function toDbInsert(job: ShortformVideoRenderJob): Record<string, unknown> {
  return {
    id: job.id,
    job_id: job.jobId,
    logical_run_key: job.logicalRunKey,
    candidate_id: job.candidateId,
    production_request_id: job.productionRequestId,
    business_date_kst: job.businessDateKst,
    status: job.status,
    short_video_brief_artifact_path: job.shortVideoBriefArtifactPath,
    source_resolution_artifact_path: job.sourceResolutionArtifactPath,
    render_profile: job.renderProfile,
    input_snapshot: job.inputSnapshot,
    attempt_count: job.attemptCount,
    max_attempts: job.maxAttempts,
    claimed_by: job.claimedBy,
    claimed_at: job.claimedAt,
    lease_expires_at: job.leaseExpiresAt,
    claim_token: job.claimToken,
    next_attempt_at: job.nextAttemptAt,
    output_artifact_path: job.outputArtifactPath,
    error_code: job.errorCode,
    error_summary: job.errorSummary,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    completed_at: job.completedAt,
  };
}

function isUniqueViolation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate key|unique/i.test(error.message ?? "");
}

async function classifyFinalizeMiss(
  repo: SupabaseShortformVideoRenderJobRepository,
  logicalRunKey: string,
  ownership: ShortformVideoRenderJobOwnership,
) {
  const existing = await repo.findByLogicalRunKey(logicalRunKey);
  if (!existing) return { ok: false as const, reason: "not_found" as const, job: null };
  if (existing.status === "READY" || existing.status === "FAILED" || existing.status === "CANCELLED") {
    return { ok: false as const, reason: "terminal" as const, job: existing };
  }
  if (existing.status !== "RUNNING") {
    return { ok: false as const, reason: "not_running" as const, job: existing };
  }
  if (
    existing.claimToken !== ownership.claimToken ||
    existing.attemptCount !== ownership.attemptCount ||
    existing.claimedBy !== ownership.claimedBy
  ) {
    return { ok: false as const, reason: "ownership_lost" as const, job: existing };
  }
  return { ok: false as const, reason: "ownership_lost" as const, job: existing };
}

export class SupabaseShortformVideoRenderJobRepository
  implements ShortformVideoRenderJobRepository
{
  constructor(private readonly client: DbClient) {}

  async getById(id: string): Promise<ShortformVideoRenderJob | null> {
    const byUuid = await this.client.from(TABLE).select("*").eq("id", id).maybeSingle();
    if (!byUuid.error && byUuid.data) return mapJobRow(byUuid.data);
    const byJobId = await this.client.from(TABLE).select("*").eq("job_id", id).maybeSingle();
    if (byJobId.error) throw new ShortformVideoRenderJobError(byJobId.error.message, "GET_FAILED");
    return byJobId.data ? mapJobRow(byJobId.data) : null;
  }

  async findByLogicalRunKey(logicalRunKey: string): Promise<ShortformVideoRenderJob | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("logical_run_key", logicalRunKey)
      .maybeSingle();
    if (error) throw new ShortformVideoRenderJobError(error.message, "FIND_FAILED");
    return data ? mapJobRow(data) : null;
  }

  async listForCandidate(candidateId: string): Promise<ShortformVideoRenderJob[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new ShortformVideoRenderJobError(error.message, "LIST_FAILED");
    return (Array.isArray(data) ? data : []).map(mapJobRow);
  }

  async listQueued(options: { limit?: number } = {}): Promise<ShortformVideoRenderJob[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("status", "QUEUED")
      .order("created_at", { ascending: true })
      .limit(options.limit ?? 50);
    if (error) throw new ShortformVideoRenderJobError(error.message, "LIST_QUEUED_FAILED");
    return (Array.isArray(data) ? data : []).map(mapJobRow);
  }

  async listClaimable(options: {
    limit?: number;
    leaseMs?: number;
    now?: Date;
  } = {}): Promise<ShortformVideoRenderJob[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .in("status", ["QUEUED", "RUNNING"])
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new ShortformVideoRenderJobError(error.message, "LIST_CLAIMABLE_FAILED");
    const now = options.now ?? new Date();
    return (Array.isArray(data) ? data : [])
      .map(mapJobRow)
      .filter((job) => isShortformRenderClaimable(job, now))
      .slice(0, options.limit ?? 50);
  }

  async enqueue(job: ShortformVideoRenderJob) {
    const existing = await this.findByLogicalRunKey(job.logicalRunKey);
    if (existing) return { job: existing, created: false };
    const { data, error } = await this.client.from(TABLE).insert(toDbInsert(job)).select("*").single();
    if (error) {
      if (isUniqueViolation(error)) {
        const again = await this.findByLogicalRunKey(job.logicalRunKey);
        if (again) return { job: again, created: false };
      }
      throw new ShortformVideoRenderJobError(error.message, "ENQUEUE_FAILED");
    }
    return { job: mapJobRow(data), created: true };
  }

  async claimNext(input: ClaimShortformVideoRenderJobInput) {
    const workerId = input.workerId?.trim();
    if (!workerId) {
      throw new ShortformVideoRenderJobError("worker id required", "WORKER_ID_REQUIRED");
    }
    const { data, error } = await this.client.rpc("claim_shortform_video_render_job", {
      p_worker_id: workerId,
      p_lease_ms: input.leaseMs ?? DEFAULT_SHORTFORM_VIDEO_RENDER_LEASE_MS,
      p_now: (input.now ?? new Date()).toISOString(),
    });
    if (error) throw new ShortformVideoRenderJobError(error.message, "CLAIM_FAILED");
    if (!data) return null;
    return mapJobRow(data);
  }

  async markReady(input: {
    logicalRunKey: string;
    outputArtifactPath: string;
    ownership: ShortformVideoRenderJobOwnership;
    now?: Date;
  }) {
    const path = input.outputArtifactPath?.trim();
    if (!path) {
      const existing = await this.findByLogicalRunKey(input.logicalRunKey);
      return { ok: false as const, reason: "invalid_transition" as const, job: existing };
    }
    const { data, error } = await this.client.rpc("finalize_shortform_video_render_job_ready", {
      p_logical_run_key: input.logicalRunKey,
      p_output_artifact_path: path,
      p_claim_token: input.ownership.claimToken,
      p_attempt_count: input.ownership.attemptCount,
      p_claimed_by: input.ownership.claimedBy,
      p_now: (input.now ?? new Date()).toISOString(),
    });
    if (error) throw new ShortformVideoRenderJobError(error.message, "MARK_READY_FAILED");
    if (!data) return classifyFinalizeMiss(this, input.logicalRunKey, input.ownership);
    return { ok: true as const, job: mapJobRow(data) };
  }

  async markFailed(input: {
    logicalRunKey: string;
    errorCode?: string | null;
    error: unknown;
    ownership: ShortformVideoRenderJobOwnership;
    now?: Date;
  }) {
    const { data, error } = await this.client.rpc("finalize_shortform_video_render_job_failed", {
      p_logical_run_key: input.logicalRunKey,
      p_error_code: sanitizeShortformVideoRenderErrorCode(input.errorCode ?? "RENDER_FAILED"),
      p_error_summary: sanitizeShortformVideoRenderErrorSummary(input.error),
      p_claim_token: input.ownership.claimToken,
      p_attempt_count: input.ownership.attemptCount,
      p_claimed_by: input.ownership.claimedBy,
      p_now: (input.now ?? new Date()).toISOString(),
    });
    if (error) throw new ShortformVideoRenderJobError(error.message, "MARK_FAILED_RPC");
    if (!data) return classifyFinalizeMiss(this, input.logicalRunKey, input.ownership);
    return { ok: true as const, job: mapJobRow(data) };
  }

  async requeueFailed(input: { logicalRunKey: string; now?: Date }) {
    const existing = await this.findByLogicalRunKey(input.logicalRunKey);
    if (!existing) throw new ShortformVideoRenderJobError("job not found", "NOT_FOUND");
    if (existing.status !== "FAILED") {
      throw new ShortformVideoRenderJobError(
        `requeue requires FAILED, got ${existing.status}`,
        "REQUEUE_REQUIRES_FAILED",
      );
    }
    const next = buildRequeuedShortformVideoRenderJob(existing, input.now ?? new Date());
    const { data, error } = await this.client
      .from(TABLE)
      .update({
        status: next.status,
        claimed_by: null,
        claimed_at: null,
        lease_expires_at: null,
        claim_token: null,
        next_attempt_at: next.nextAttemptAt,
        completed_at: null,
        output_artifact_path: null,
        error_code: null,
        error_summary: null,
        attempt_count: 0,
        updated_at: next.updatedAt,
      })
      .eq("logical_run_key", input.logicalRunKey)
      .eq("status", "FAILED")
      .select("*")
      .maybeSingle();
    if (error) throw new ShortformVideoRenderJobError(error.message, "REQUEUE_FAILED");
    if (!data) {
      throw new ShortformVideoRenderJobError("requeue requires FAILED", "REQUEUE_REQUIRES_FAILED");
    }
    return mapJobRow(data);
  }

  async cancel(input: { logicalRunKey: string; now?: Date }) {
    const existing = await this.findByLogicalRunKey(input.logicalRunKey);
    if (!existing) throw new ShortformVideoRenderJobError("job not found", "NOT_FOUND");
    if (existing.status !== "QUEUED" && existing.status !== "FAILED") {
      throw new ShortformVideoRenderJobError(
        `cannot cancel from ${existing.status}`,
        "INVALID_TRANSITION",
      );
    }
    const iso = (input.now ?? new Date()).toISOString();
    const { data, error } = await this.client
      .from(TABLE)
      .update({
        status: "CANCELLED",
        claimed_by: null,
        claimed_at: null,
        lease_expires_at: null,
        claim_token: null,
        updated_at: iso,
      })
      .eq("logical_run_key", input.logicalRunKey)
      .in("status", ["QUEUED", "FAILED"])
      .select("*")
      .maybeSingle();
    if (error) throw new ShortformVideoRenderJobError(error.message, "CANCEL_FAILED");
    if (!data) {
      throw new ShortformVideoRenderJobError("cannot cancel", "INVALID_TRANSITION");
    }
    return mapJobRow(data);
  }
}
