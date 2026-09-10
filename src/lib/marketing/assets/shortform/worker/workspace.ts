import { createHash } from "node:crypto";
import {
  mkdirSync,
  existsSync,
  rmSync,
  writeFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, resolve, isAbsolute } from "node:path";

import { MarketingAssetPathError } from "@/lib/marketing/assets/errors";
import { assertPathInside, isPathInside } from "@/lib/marketing/assets/paths";
import { SHORTFORM_WORKER_WORKSPACE_DEFAULT_PATH } from "@/lib/marketing/assets/shortform/storagePolicy";

const JOB_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export type ShortformJobWorkspace = {
  root: string;
  jobId: string;
  jobDir: string;
  inputDir: string;
  sourceDir: string;
  audioDir: string;
  renderDir: string;
  outputDir: string;
  stateDir: string;
};

export function assertSafeShortformJobId(jobId: string): string {
  if (!jobId || typeof jobId !== "string" || jobId.includes("\0")) {
    throw new MarketingAssetPathError("jobId must be a non-empty string");
  }
  if (isAbsolute(jobId) || jobId.includes("/") || jobId.includes("\\") || jobId.includes("..")) {
    throw new MarketingAssetPathError("jobId must not contain path separators or traversal");
  }
  if (!JOB_ID_PATTERN.test(jobId)) {
    throw new MarketingAssetPathError("jobId must be a safe single path segment");
  }
  return jobId;
}

export function assertBulkWorkspaceNotTmp(workspaceRoot: string): void {
  const resolved = resolve(workspaceRoot);
  if (resolved === "/tmp" || resolved.startsWith("/tmp/")) {
    throw new MarketingAssetPathError("bulk shortform workspace must not use /tmp");
  }
}

export function resolveShortformWorkspaceRoot(workspaceRoot?: string): string {
  const root = resolve(workspaceRoot?.trim() || SHORTFORM_WORKER_WORKSPACE_DEFAULT_PATH);
  assertBulkWorkspaceNotTmp(root);
  return root;
}

export function resolveShortformJobWorkspace(input: {
  workspaceRoot: string;
  jobId: string;
}): ShortformJobWorkspace {
  const root = resolveShortformWorkspaceRoot(input.workspaceRoot);
  const jobId = assertSafeShortformJobId(input.jobId);
  const jobDir = assertPathInside(root, join(root, "jobs", jobId), "jobDir");
  return {
    root,
    jobId,
    jobDir,
    inputDir: join(jobDir, "input"),
    sourceDir: join(jobDir, "source"),
    audioDir: join(jobDir, "audio"),
    renderDir: join(jobDir, "render"),
    outputDir: join(jobDir, "output"),
    stateDir: join(jobDir, "state"),
  };
}

export function ensureShortformWorkspaceRoot(workspaceRoot: string): string {
  const root = resolveShortformWorkspaceRoot(workspaceRoot);
  mkdirSync(join(root, "jobs"), { recursive: true });
  return root;
}

export function createShortformJobWorkspace(input: {
  workspaceRoot: string;
  jobId: string;
  metadata?: {
    logicalRunKey: string;
    workerId: string;
    claimTokenHash?: string | null;
  };
}): ShortformJobWorkspace {
  const workspace = resolveShortformJobWorkspace(input);
  for (const dir of [
    workspace.jobDir,
    workspace.inputDir,
    workspace.sourceDir,
    workspace.audioDir,
    workspace.renderDir,
    workspace.outputDir,
    workspace.stateDir,
  ]) {
    mkdirSync(dir, { recursive: true });
  }

  if (input.metadata) {
    const statePath = join(workspace.stateDir, "job.json");
    writeFileSync(
      statePath,
      JSON.stringify(
        {
          jobId: workspace.jobId,
          logicalRunKey: input.metadata.logicalRunKey,
          workerId: input.metadata.workerId,
          createdAt: new Date().toISOString(),
          claimTokenHash: input.metadata.claimTokenHash ?? null,
        },
        null,
        2,
      ),
      "utf8",
    );
  }
  return workspace;
}

export function hashClaimTokenForMetadata(claimToken: string | null | undefined): string | null {
  if (!claimToken) return null;
  return createHash("sha256").update(claimToken).digest("hex").slice(0, 16);
}

/** Retain failed workspaces (SV-1 24h policy; sweeper is out of SV-7 scope). */
export function retainFailedShortformJobWorkspace(_workspace: ShortformJobWorkspace): void {
  // intentional no-op: do not delete on failure
}

/**
 * Success cleanup only after markReady durability invariant.
 * Deletes only the per-job directory under workspace root.
 */
export function cleanupSuccessfulShortformJobWorkspace(workspace: ShortformJobWorkspace): void {
  if (!isPathInside(workspace.root, workspace.jobDir)) {
    throw new MarketingAssetPathError("refusing to cleanup path outside workspace root");
  }
  if (existsSync(workspace.jobDir)) {
    rmSync(workspace.jobDir, { recursive: true, force: true });
  }
}

export function measureDirectoryUsedBytes(path: string): number {
  if (!existsSync(path)) return 0;
  let total = 0;
  const stack = [path];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      try {
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile()) {
          total += statSync(full).size;
        }
      } catch {
        // skip unreadable entries
      }
    }
  }
  return total;
}
