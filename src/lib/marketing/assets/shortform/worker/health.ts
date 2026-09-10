import { accessSync, constants, existsSync } from "node:fs";

import type { ShortformVideoWorkerConfig } from "@/lib/marketing/assets/shortform/worker/config";
import type { ShortformVideoRenderExecutor } from "@/lib/marketing/assets/shortform/worker/executor";
import { probeShortformWorkerCapacity } from "@/lib/marketing/assets/shortform/worker/capacityProbe";
import { isShortformVideoRenderJobRepositoryConfigured } from "@/lib/marketing/assets/shortform/renderJob/createRepository";

export type ShortformWorkerHealthReport = {
  workerId: string;
  enabled: boolean;
  executionMode: string;
  executionReady: boolean;
  executionReadinessReason: string;
  workspaceRoot: string;
  workspaceReady: boolean;
  rootFreeBytes: number | null;
  rootTotalBytes: number | null;
  workspaceUsedBytes: number | null;
  storageStatus: string | null;
  allowClaimNewJobs: boolean | null;
  repositoryConfigured: boolean;
  nodeAvailable: boolean;
  ffmpegAvailable: boolean;
  ffprobeAvailable: boolean;
  leaseRenewalSupported: false;
  concurrency: 1;
  maxJobsPerRun: number;
  productionReady: false;
};

function commandExists(bin: string): boolean {
  const pathEnv = process.env.PATH ?? "";
  for (const dir of pathEnv.split(":")) {
    if (!dir) continue;
    const full = `${dir}/${bin}`;
    if (!existsSync(full)) continue;
    try {
      accessSync(full, constants.X_OK);
      return true;
    } catch {
      /* continue */
    }
  }
  return false;
}

/**
 * Read-only health/capability report. Never claims jobs or prints secrets.
 */
export async function buildShortformWorkerHealthReport(input: {
  config: ShortformVideoWorkerConfig;
  executor: ShortformVideoRenderExecutor;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): Promise<ShortformWorkerHealthReport> {
  let capacity: Awaited<ReturnType<typeof probeShortformWorkerCapacity>> | null = null;
  let workspaceReady = false;
  try {
    capacity = await probeShortformWorkerCapacity({ workspaceRoot: input.config.workspaceRoot });
    workspaceReady = true;
  } catch {
    workspaceReady = false;
  }

  return {
    workerId: input.config.workerId,
    enabled: input.config.enabled,
    executionMode: input.config.executionMode,
    executionReady: input.executor.isReady(),
    executionReadinessReason: input.executor.readinessReason(),
    workspaceRoot: input.config.workspaceRoot,
    workspaceReady,
    rootFreeBytes: capacity?.rootFreeBytes ?? null,
    rootTotalBytes: capacity?.rootTotalBytes ?? null,
    workspaceUsedBytes: capacity?.workspaceUsedBytes ?? null,
    storageStatus: capacity?.decision.status ?? null,
    allowClaimNewJobs: capacity?.decision.allowClaimNewJobs ?? null,
    repositoryConfigured: isShortformVideoRenderJobRepositoryConfigured(input.env ?? process.env),
    nodeAvailable: true,
    ffmpegAvailable: commandExists("ffmpeg"),
    ffprobeAvailable: commandExists("ffprobe"),
    leaseRenewalSupported: false,
    concurrency: 1,
    maxJobsPerRun: input.config.maxJobsPerRun,
    productionReady: false,
  };
}
