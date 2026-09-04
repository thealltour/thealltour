export const MARKETING_PRODUCTION_REQUEST_CONTRACT =
  "daily-marketing-production-request-v1" as const;

export type MarketingProductionRequestStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

/**
 * Default stale lease: 30 minutes.
 * Operational assumption (configurable via --stale-after-ms /
 * MARKETING_PRODUCTION_STALE_AFTER_MS): specialist Hermes timeout is 180s
 * (`MARKETING_CRON_HERMES_TIMEOUT_MS`); a full MM→CS→GA path is expected well
 * under ~10 minutes. 30m is intentionally above that envelope so fresh workers
 * are not reclaimed mid-flight. No live duration telemetry was available to
 * tune tighter — keep configurable rather than guessing shorter.
 */
export const DEFAULT_PRODUCTION_REQUEST_STALE_AFTER_MS = 30 * 60 * 1000;
export const DEFAULT_PRODUCTION_WORKER_MAX_BATCH = 3;
export const MAX_PRODUCTION_ERROR_MESSAGE_LENGTH = 400;

export type MarketingProductionRequest = {
  contract: typeof MARKETING_PRODUCTION_REQUEST_CONTRACT;
  requestId: string;
  /** Stable production identity — also CompletedMarketingCandidate.logical_run_key target. */
  logicalRunKey: string;
  slateId: string;
  slateItemId: string;
  businessDateKst: string;
  status: MarketingProductionRequestStatus;
  createdAt: string;
  updatedAt: string;
  /** When the worker atomically claimed this request (QUEUED→RUNNING or stale reclaim). */
  claimedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  attemptCount: number;
  /**
   * Opaque claim ownership token minted on each successful claim.
   * Finalization must CAS on this token so a superseded stale worker cannot win.
   */
  claimToken: string | null;
  /** Sanitized, bounded failure text. Never secrets/stack with credentials. */
  lastError: string | null;
  /** Non-sensitive worker identity (hostname/role), never secrets. */
  workerId: string | null;
  selection: {
    title: string;
    summary: string;
    agendaCandidateId: string | null;
    researchBriefId: string | null;
    rationale: string[];
    recommendedChannel: string | null;
    recommendedFormats: string[];
  };
  /** @deprecated Prefer lastError; kept for G-5 payload compatibility. */
  errorMessage: string | null;
  completedCandidateId: string | null;
  metadata: Record<string, unknown>;
};

export type FinalizeProductionRequestResult =
  | { ok: true; request: MarketingProductionRequest }
  | {
      ok: false;
      reason: "not_found" | "ownership_lost" | "not_running" | "terminal";
      request: MarketingProductionRequest | null;
    };

export function sanitizeProductionWorkerError(
  error: unknown,
  limit = MAX_PRODUCTION_ERROR_MESSAGE_LENGTH,
): string {
  let text = error instanceof Error ? error.message : String(error ?? "unknown_error");
  text = text
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/sk-[a-zA-Z0-9_-]+/gi, "[redacted]")
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, "[redacted-jwt]")
    .replace(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S+/gi, "SUPABASE_SERVICE_ROLE_KEY=[redacted]")
    .replace(/Authorization:\s*\S+/gi, "Authorization: [redacted]")
    .replace(/\/home\/[^\s:]+/g, "[path]");
  // Drop multi-line stacks — keep first line only.
  text = text.split("\n")[0]?.trim() || "unknown_error";
  return text.slice(0, limit);
}

export function normalizeProductionRequest(
  raw: MarketingProductionRequest | Record<string, unknown>,
): MarketingProductionRequest {
  const row = raw as MarketingProductionRequest;
  return {
    ...row,
    claimedAt: row.claimedAt ?? null,
    startedAt: row.startedAt ?? null,
    completedAt: row.completedAt ?? null,
    failedAt: row.failedAt ?? null,
    attemptCount: typeof row.attemptCount === "number" ? row.attemptCount : 0,
    claimToken: row.claimToken ?? null,
    lastError: row.lastError ?? row.errorMessage ?? null,
    workerId: row.workerId ?? null,
    errorMessage: row.errorMessage ?? row.lastError ?? null,
    metadata: row.metadata ?? {},
  };
}

export function resolveProductionStaleAfterMs(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  override?: number,
): number {
  if (typeof override === "number" && Number.isFinite(override) && override > 0) {
    return Math.trunc(override);
  }
  const raw = env.MARKETING_PRODUCTION_STALE_AFTER_MS?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
  }
  return DEFAULT_PRODUCTION_REQUEST_STALE_AFTER_MS;
}
