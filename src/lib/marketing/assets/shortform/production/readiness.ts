import "server-only";

import { accessSync, constants, existsSync } from "node:fs";

import { parseVoiceStudioConfig } from "@/lib/marketing/tts/voiceStudio/config";
import { SHORTFORM_WORKER_WORKSPACE_DEFAULT_PATH } from "@/lib/marketing/assets/shortform/storagePolicy";
import {
  MARKETING_ASSET_TRANSFER_BASE_URL_ENV,
  MARKETING_ASSET_TRANSFER_TOKEN_ENV,
  MARKETING_ASSET_TRANSPORT_MODE_ENV,
  parseMarketingAssetTransportMode,
  type MarketingAssetTransportMode,
} from "@/lib/marketing/assets/transport/contracts";

export type ShortformProductionReadiness = {
  ready: boolean;
  reason: string;
  transportMode: MarketingAssetTransportMode | "invalid";
  checks: {
    ffmpeg: boolean;
    ffprobe: boolean;
    workspace: boolean;
    voiceStudioConfig: boolean;
    remotionPackages: boolean;
    /** Required in local mode only. Always true (N/A) in http mode. */
    marketingAssetRoot: boolean;
    /** Required in http mode. Always true (N/A) in local mode. */
    transferBaseUrl: boolean;
    /** Required in http mode. Always true (N/A) in local mode. */
    transferToken: boolean;
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
 * HTTP transport mode does not require local MARKETING_ASSET_ROOT (SV-8B2).
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

  let transportMode: MarketingAssetTransportMode | "invalid" = "invalid";
  let marketingAssetRoot = false;
  let transferBaseUrl = false;
  let transferToken = false;
  try {
    transportMode = parseMarketingAssetTransportMode(env);
    if (transportMode === "http") {
      marketingAssetRoot = true; // not required
      transferBaseUrl = Boolean(env[MARKETING_ASSET_TRANSFER_BASE_URL_ENV]?.trim());
      transferToken = Boolean(env[MARKETING_ASSET_TRANSFER_TOKEN_ENV]?.trim());
    } else {
      marketingAssetRoot = Boolean(env.MARKETING_ASSET_ROOT?.trim());
      transferBaseUrl = true; // not required
      transferToken = true; // not required
    }
  } catch {
    transportMode = "invalid";
    marketingAssetRoot = false;
    transferBaseUrl = false;
    transferToken = false;
  }

  const checks = {
    ffmpeg,
    ffprobe,
    workspace,
    voiceStudioConfig,
    remotionPackages,
    marketingAssetRoot,
    transferBaseUrl,
    transferToken,
  };

  const requireVs = input?.requireVoiceStudio !== false;
  const transportReady =
    transportMode !== "invalid" && marketingAssetRoot && transferBaseUrl && transferToken;
  const ready =
    ffmpeg &&
    ffprobe &&
    workspace &&
    remotionPackages &&
    transportReady &&
    (!requireVs || voiceStudioConfig);

  let reason = "ready";
  if (!ready) {
    const missing = Object.entries(checks)
      .filter(([, ok]) => !ok)
      .map(([k]) => k);
    if (transportMode === "invalid") {
      missing.unshift(`${MARKETING_ASSET_TRANSPORT_MODE_ENV}_invalid`);
    }
    reason = `not_ready:${missing.join(",") || "unknown"}`;
  }

  return { ready, reason, transportMode, checks };
}
