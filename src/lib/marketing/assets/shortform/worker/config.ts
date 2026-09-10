/**
 * SV-7 — Mini-PC shortform worker configuration (fail-closed defaults).
 */

import { hostname } from "node:os";

import {
  DEFAULT_SHORTFORM_VIDEO_RENDER_LEASE_MS,
} from "@/lib/marketing/assets/shortform/renderJob/contracts";
import { SHORTFORM_WORKER_WORKSPACE_DEFAULT_PATH } from "@/lib/marketing/assets/shortform/storagePolicy";

export const SHORTFORM_VIDEO_EXECUTION_MODES = ["disabled", "dry_run", "production"] as const;
export type ShortformVideoExecutionMode = (typeof SHORTFORM_VIDEO_EXECUTION_MODES)[number];

export const DEFAULT_SHORTFORM_WORKER_MAX_JOBS_PER_RUN = 1;
export const SHORTFORM_WORKER_CONCURRENCY = 1 as const;

/** Lease renewal is intentionally unsupported in SV-7 (oneshot + 30m lease). */
export const SHORTFORM_WORKER_LEASE_RENEWAL_SUPPORTED = false as const;

export type ShortformVideoWorkerConfig = {
  enabled: boolean;
  executionMode: ShortformVideoExecutionMode;
  workerId: string;
  workspaceRoot: string;
  maxJobsPerRun: number;
  leaseMs: number;
  /** Never true in production CLI path — tests may inject fake executor separately. */
  allowFakeExecutor: boolean;
};

function parseBoolTrue(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase() === "true";
}

function parseExecutionMode(raw: string | undefined): ShortformVideoExecutionMode {
  const value = raw?.trim().toLowerCase();
  if (value === "dry_run" || value === "production" || value === "disabled") return value;
  return "disabled";
}

export function defaultShortformWorkerId(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  const override =
    env.SHORTFORM_WORKER_ID?.trim() ||
    env.SHORTFORM_VIDEO_RENDER_WORKER_ID?.trim() ||
    "";
  if (override) return override.slice(0, 80);
  return `minipc:${hostname()}`.slice(0, 80);
}

export function loadShortformVideoWorkerConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): ShortformVideoWorkerConfig {
  const maxJobsRaw = Number(
    env.SHORTFORM_WORKER_MAX_JOBS_PER_RUN?.trim() ?? DEFAULT_SHORTFORM_WORKER_MAX_JOBS_PER_RUN,
  );
  const maxJobsPerRun =
    Number.isFinite(maxJobsRaw) && maxJobsRaw >= 1
      ? Math.min(Math.trunc(maxJobsRaw), 3)
      : DEFAULT_SHORTFORM_WORKER_MAX_JOBS_PER_RUN;

  const leaseRaw = Number(env.SHORTFORM_VIDEO_RENDER_LEASE_MS?.trim() ?? DEFAULT_SHORTFORM_VIDEO_RENDER_LEASE_MS);
  const leaseMs =
    Number.isFinite(leaseRaw) && leaseRaw > 0
      ? Math.trunc(leaseRaw)
      : DEFAULT_SHORTFORM_VIDEO_RENDER_LEASE_MS;

  const workspaceRoot =
    env.SHORTFORM_WORKER_WORKSPACE_PATH?.trim() || SHORTFORM_WORKER_WORKSPACE_DEFAULT_PATH;

  return {
    enabled: parseBoolTrue(env.SHORTFORM_VIDEO_WORKER_ENABLED),
    executionMode: parseExecutionMode(env.SHORTFORM_VIDEO_EXECUTION_MODE),
    workerId: defaultShortformWorkerId(env),
    workspaceRoot,
    maxJobsPerRun,
    leaseMs,
    allowFakeExecutor: false,
  };
}
