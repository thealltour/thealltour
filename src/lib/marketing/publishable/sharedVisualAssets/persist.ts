/**
 * Persist / read SharedVisualAssetsManifest.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { overwritePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import {
  SHARED_VISUAL_ASSETS_CONTRACT,
  type SharedVisualAsset,
  type SharedVisualAssetsManifest,
} from "@/lib/marketing/publishable/sharedVisualAssets/contracts";
import {
  SHARED_VISUAL_ASSETS_MEDIA_TYPE,
  SHARED_VISUAL_ASSETS_RELATIVE_PATH,
} from "@/lib/marketing/publishable/sharedVisualAssets/paths";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseAsset(raw: unknown): SharedVisualAsset | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const visualId = asString(row.visualId);
  const storedPath = asString(row.storedPath);
  if (!visualId || !storedPath) return null;
  return {
    visualId,
    expectedFilename: asString(row.expectedFilename) || `${visualId}.png`,
    storedFilename: asString(row.storedFilename) || storedPath.split("/").pop() || visualId,
    storedPath,
    mimeType: asString(row.mimeType) || "application/octet-stream",
    byteSize:
      typeof row.byteSize === "number" && Number.isFinite(row.byteSize)
        ? Math.max(0, Math.floor(row.byteSize))
        : 0,
    ...(typeof row.width === "number" && Number.isFinite(row.width)
      ? { width: Math.floor(row.width) }
      : {}),
    ...(typeof row.height === "number" && Number.isFinite(row.height)
      ? { height: Math.floor(row.height) }
      : {}),
    uploadedAt: asString(row.uploadedAt) || new Date(0).toISOString(),
    status: "uploaded",
  };
}

export function parseSharedVisualAssetsManifest(raw: unknown): SharedVisualAssetsManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.contract !== SHARED_VISUAL_ASSETS_CONTRACT) return null;
  const sourceAssetId = asString(row.sourceAssetId);
  if (!sourceAssetId) return null;
  const assetsRaw = Array.isArray(row.assets) ? row.assets : [];
  const assets: SharedVisualAsset[] = [];
  for (const a of assetsRaw) {
    const parsed = parseAsset(a);
    if (parsed) assets.push(parsed);
  }
  return {
    contract: SHARED_VISUAL_ASSETS_CONTRACT,
    sourceAssetId,
    sourceAssetVersion:
      typeof row.sourceAssetVersion === "number" && Number.isFinite(row.sourceAssetVersion)
        ? Math.floor(row.sourceAssetVersion)
        : 0,
    sourceSharedVisualPlanFingerprint: asString(row.sourceSharedVisualPlanFingerprint),
    sourceManualAstraHandoffFingerprint: asString(row.sourceManualAstraHandoffFingerprint),
    updatedAt: asString(row.updatedAt) || new Date(0).toISOString(),
    assets,
  };
}

export function readSharedVisualAssetsManifest(
  packageRoot: string,
): SharedVisualAssetsManifest | null {
  const path = join(packageRoot, SHARED_VISUAL_ASSETS_RELATIVE_PATH);
  if (!existsSync(path)) return null;
  try {
    return parseSharedVisualAssetsManifest(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return null;
  }
}

export function persistSharedVisualAssetsManifest(input: {
  packageRoot: string;
  manifest: SharedVisualAssetsManifest;
  createdAt?: string;
}): void {
  overwritePackageArtifact({
    packageRoot: input.packageRoot,
    planned: {
      relativePath: SHARED_VISUAL_ASSETS_RELATIVE_PATH,
      content: stableJsonBytes(input.manifest),
      kind: "context",
      origin: "human_edit",
      mediaType: SHARED_VISUAL_ASSETS_MEDIA_TYPE,
    },
    createdAt: input.createdAt ?? input.manifest.updatedAt,
  });
}

/** Upsert one asset by visualId; preserve siblings. */
export function upsertSharedVisualAsset(input: {
  manifest: SharedVisualAssetsManifest | null;
  asset: SharedVisualAsset;
  sourceAssetId: string;
  sourceAssetVersion: number;
  sourceSharedVisualPlanFingerprint: string;
  sourceManualAstraHandoffFingerprint: string;
  now?: Date;
}): SharedVisualAssetsManifest {
  const nowIso = (input.now ?? new Date()).toISOString();
  const existing = input.manifest?.assets ?? [];
  const nextAssets = [
    ...existing.filter((a) => a.visualId !== input.asset.visualId),
    input.asset,
  ].sort((a, b) => a.visualId.localeCompare(b.visualId));
  return {
    contract: SHARED_VISUAL_ASSETS_CONTRACT,
    sourceAssetId: input.sourceAssetId,
    sourceAssetVersion: input.sourceAssetVersion,
    sourceSharedVisualPlanFingerprint: input.sourceSharedVisualPlanFingerprint,
    sourceManualAstraHandoffFingerprint: input.sourceManualAstraHandoffFingerprint,
    updatedAt: nowIso,
    assets: nextAssets,
  };
}
