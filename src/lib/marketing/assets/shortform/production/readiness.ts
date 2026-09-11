import "server-only";

import { accessSync, constants, existsSync } from "node:fs";

import { parseVoiceStudioConfig } from "@/lib/marketing/tts/voiceStudio/config";
import { SHORTFORM_WORKER_WORKSPACE_DEFAULT_PATH } from "@/lib/marketing/assets/shortform/storagePolicy";

export type ShortformProductionReadiness = {
  ready: boolean;
  reason: string;
  checks: {
    ffmpeg: boolean;
    ffprobe: boolean;
    workspace: boolean;
    voiceStudioConfig: boolean;
    remotionPackages: boolean;
    marketingAssetRoot: boolean;
  };
};

function commandExists(bin: string): boolean {
  for (const dir of (process.env.PATH ?? "").split(":")) {
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

function remotionPackagesPresent(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createRequire } = require("node:module") as typeof import("node:module");
    const req = createRequire(__filename);
    req.resolve("remotion");
    req.resolve("@remotion/renderer");
    return true;
  } catch {
    return false;
  }
}

/**
 * Fail-closed readiness for production executor.
 * Missing ffmpeg/ffprobe keeps worker from claiming (SV-7 invariant).
 */
export function probeShortformProductionReadiness(input?: {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  workspaceRoot?: string;
  requireVoiceStudio?: boolean;
}): ShortformProductionReadiness {
  const env = input?.env ?? process.env;
  const workspaceRoot = input?.workspaceRoot?.trim() || SHORTFORM_WORKER_WORKSPACE_DEFAULT_PATH;
  const ffmpeg = commandExists("ffmpeg");
  const ffprobe = commandExists("ffprobe");
  const workspace = Boolean(workspaceRoot) && !workspaceRoot.startsWith("/tmp");
  let voiceStudioConfig = false;
  try {
    parseVoiceStudioConfig(env);
    voiceStudioConfig = true;
  } catch {
    voiceStudioConfig = false;
  }
  const remotionPackages = remotionPackagesPresent();
  const marketingAssetRoot = Boolean(env.MARKETING_ASSET_ROOT?.trim());

  const checks = {
    ffmpeg,
    ffprobe,
    workspace,
    voiceStudioConfig,
    remotionPackages,
    marketingAssetRoot,
  };

  // VoiceStudio may be loopback-only; require config parse success when requireVoiceStudio.
  const requireVs = input?.requireVoiceStudio !== false;
  const ready =
    ffmpeg &&
    ffprobe &&
    workspace &&
    remotionPackages &&
    marketingAssetRoot &&
    (!requireVs || voiceStudioConfig);

  let reason = "ready";
  if (!ready) {
    const missing = Object.entries(checks)
      .filter(([, ok]) => !ok)
      .map(([k]) => k);
    reason = `not_ready:${missing.join(",") || "unknown"}`;
  }

  return { ready, reason, checks };
}
