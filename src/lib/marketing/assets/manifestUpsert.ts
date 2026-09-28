import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import {
  MARKETING_ASSET_MANIFEST_CONTRACT,
  type MarketingAssetArtifact,
  type MarketingAssetManifest,
  type MediaBrief,
} from "@/lib/marketing/assets/contracts";
import { sha256Buffer, stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { parseMarketingAssetManifest } from "@/lib/marketing/assets/parse";

export const PACKAGE_MANIFEST_RELATIVE_PATH = "manifest.json" as const;

function integrityDigest(artifacts: MarketingAssetArtifact[]): string {
  const lines = [...artifacts]
    .map((artifact) => `${artifact.relativePath}:${artifact.sha256}`)
    .sort((a, b) => a.localeCompare(b));
  return sha256Buffer(lines.join("\n"));
}

export function readPackageManifest(packageRoot: string): MarketingAssetManifest | null {
  const manifestPath = join(packageRoot, PACKAGE_MANIFEST_RELATIVE_PATH);
  if (!existsSync(manifestPath)) return null;
  try {
    return parseMarketingAssetManifest(JSON.parse(readFileSync(manifestPath, "utf8")) as unknown);
  } catch {
    return null;
  }
}

/**
 * Record a rewritten artifact's sha in manifest.json so transport integrity checks keep passing.
 * No-op when the package has no manifest yet (partial packages in tests / pre-export).
 */
export function upsertPackageManifestArtifact(input: {
  packageRoot: string;
  artifact: MarketingAssetArtifact;
  createdAt: string;
  /** Rewritten media-brief.json content — the manifest embeds a copy of it. */
  mediaBrief?: MediaBrief;
}): boolean {
  const existing = readPackageManifest(input.packageRoot);
  if (!existing) return false;

  const byPath = new Map(existing.artifacts.map((a) => [a.relativePath, a]));
  byPath.set(input.artifact.relativePath, input.artifact);
  const merged = [...byPath.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const next = parseMarketingAssetManifest({
    ...existing,
    contract: MARKETING_ASSET_MANIFEST_CONTRACT,
    updatedAt: input.createdAt,
    ...(input.mediaBrief ? { mediaBrief: input.mediaBrief } : {}),
    artifacts: merged,
    integrity: {
      algorithm: "sha256",
      artifactCount: merged.length,
      digest: integrityDigest(merged),
    },
  });
  atomicWriteFile(join(input.packageRoot, PACKAGE_MANIFEST_RELATIVE_PATH), stableJsonBytes(next));
  return true;
}
