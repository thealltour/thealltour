import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MARKETING_ASSET_MANIFEST_CONTRACT,
  type MarketingAssetArtifact,
  type MarketingAssetManifest,
} from "@/lib/marketing/assets/contracts";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { sha256Buffer, stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { parseMarketingAssetManifest } from "@/lib/marketing/assets/parse";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { writePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import { ShortformProductionError } from "@/lib/marketing/assets/shortform/production/errors";
import {
  SHORTFORM_FINAL_ARTIFACT_KIND,
  SHORTFORM_FINAL_MEDIA_TYPE,
  SHORTFORM_FINAL_ORIGIN,
  SHORTFORM_FINAL_RELATIVE_PATH,
} from "@/lib/marketing/assets/shortform/production/paths";

function integrityDigest(artifacts: MarketingAssetArtifact[]): string {
  const lines = [...artifacts]
    .map((artifact) => `${artifact.relativePath}:${artifact.sha256}`)
    .sort((a, b) => a.localeCompare(b));
  return sha256Buffer(lines.join("\n"));
}

function readExistingManifest(packageRoot: string): MarketingAssetManifest | null {
  const manifestPath = join(packageRoot, "manifest.json");
  if (!existsSync(manifestPath)) return null;
  try {
    return parseMarketingAssetManifest(JSON.parse(readFileSync(manifestPath, "utf8")) as unknown);
  } catch {
    return null;
  }
}

function upsertManifestArtifact(input: {
  packageRoot: string;
  artifact: MarketingAssetArtifact;
  createdAt: string;
}): void {
  const existing = readExistingManifest(input.packageRoot);
  if (!existing) return; // package may be partial in tests; durable file + sha256 still required

  const byPath = new Map(existing.artifacts.map((a) => [a.relativePath, a]));
  byPath.set(input.artifact.relativePath, input.artifact);
  const merged = [...byPath.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const next = parseMarketingAssetManifest({
    ...existing,
    contract: MARKETING_ASSET_MANIFEST_CONTRACT,
    updatedAt: input.createdAt,
    artifacts: merged,
    integrity: {
      algorithm: "sha256",
      artifactCount: merged.length,
      digest: integrityDigest(merged),
    },
  });
  atomicWriteFile(join(input.packageRoot, "manifest.json"), stableJsonBytes(next));
}

/**
 * Persist workspace final into Candidate Package (durable) before READY.
 * Never marks READY itself — returns package-relative path for worker markReady.
 */
export function persistShortformFinalArtifact(input: {
  packageRoot: string;
  workspaceFinalAbsolutePath: string;
  createdAt?: string;
}): {
  relativePath: typeof SHORTFORM_FINAL_RELATIVE_PATH;
  sha256: string;
  byteSize: number;
  manifestUpdated: boolean;
} {
  if (!existsSync(input.workspaceFinalAbsolutePath)) {
    throw new ShortformProductionError(
      "workspace final missing before persist",
      "PERSIST_INPUT_MISSING",
    );
  }
  const content = readFileSync(input.workspaceFinalAbsolutePath);
  if (content.byteLength <= 0) {
    throw new ShortformProductionError("workspace final empty", "PERSIST_EMPTY");
  }
  const createdAt = input.createdAt ?? new Date().toISOString();
  const written = writePackageArtifact({
    packageRoot: input.packageRoot,
    createdAt,
    planned: {
      relativePath: SHORTFORM_FINAL_RELATIVE_PATH,
      content,
      kind: SHORTFORM_FINAL_ARTIFACT_KIND,
      origin: SHORTFORM_FINAL_ORIGIN,
      mediaType: SHORTFORM_FINAL_MEDIA_TYPE,
    },
  });

  const absolute = resolvePackageArtifactPath({
    packageRoot: input.packageRoot,
    relativePath: SHORTFORM_FINAL_RELATIVE_PATH,
  });
  if (!existsSync(absolute)) {
    throw new ShortformProductionError("durable final missing after write", "PERSIST_VERIFY_FAILED");
  }
  const durable = readFileSync(absolute);
  const sha256 = sha256Buffer(durable);
  if (sha256 !== written.artifact.sha256) {
    throw new ShortformProductionError("durable sha256 mismatch", "PERSIST_VERIFY_FAILED");
  }

  const hadManifest = readExistingManifest(input.packageRoot) != null;
  upsertManifestArtifact({
    packageRoot: input.packageRoot,
    artifact: written.artifact,
    createdAt,
  });
  const manifestUpdated = hadManifest;

  return {
    relativePath: SHORTFORM_FINAL_RELATIVE_PATH,
    sha256,
    byteSize: durable.byteLength,
    manifestUpdated,
  };
}
