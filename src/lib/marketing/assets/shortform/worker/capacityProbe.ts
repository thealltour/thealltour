import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { readFilesystemCapacity } from "@/lib/marketing/assets/shortform/capacity";
import {
  evaluateShortformWorkerStorage,
  SHORTFORM_WORKER_STORAGE_POLICY_V1,
  type ShortformWorkerStorageDecision,
} from "@/lib/marketing/assets/shortform/storagePolicy";
import {
  measureDirectoryUsedBytes,
  resolveShortformWorkspaceRoot,
} from "@/lib/marketing/assets/shortform/worker/workspace";

export type ShortformWorkerCapacityProbeResult = {
  workspaceRoot: string;
  rootPathProbed: string;
  rootFreeBytes: number;
  rootTotalBytes: number;
  workspaceUsedBytes: number;
  decision: ShortformWorkerStorageDecision;
};

/**
 * Ensure workspace root exists, then evaluate SV-1 worker storage decision.
 * Does not claim jobs or delete media.
 */
export async function probeShortformWorkerCapacity(input: {
  workspaceRoot?: string;
  /** Injected for tests. */
  readCapacity?: typeof readFilesystemCapacity;
  measureWorkspace?: (path: string) => number;
}): Promise<ShortformWorkerCapacityProbeResult> {
  const workspaceRoot = resolveShortformWorkspaceRoot(input.workspaceRoot);
  mkdirSync(resolve(workspaceRoot, "jobs"), { recursive: true });

  const probePath = existsSync(workspaceRoot) ? workspaceRoot : dirname(workspaceRoot);
  const readCapacity = input.readCapacity ?? readFilesystemCapacity;
  const capacity = await readCapacity(probePath);
  const measure = input.measureWorkspace ?? measureDirectoryUsedBytes;
  const workspaceUsedBytes = measure(workspaceRoot);
  const decision = evaluateShortformWorkerStorage({
    rootFreeBytes: capacity.freeBytes,
    workspaceUsedBytes,
    workspaceBudgetBytes: SHORTFORM_WORKER_STORAGE_POLICY_V1.workspaceBudgetBytes,
  });

  return {
    workspaceRoot,
    rootPathProbed: probePath,
    rootFreeBytes: capacity.freeBytes,
    rootTotalBytes: capacity.totalBytes,
    workspaceUsedBytes,
    decision,
  };
}
