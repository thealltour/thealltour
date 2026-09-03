import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import type { MarketingAssetArtifact, MarketingAssetArtifactKind, MarketingAssetArtifactOrigin } from "@/lib/marketing/assets/contracts";
import { MarketingAssetConflictError } from "@/lib/marketing/assets/errors";
import { byteSize, sha256Buffer } from "@/lib/marketing/assets/hashing";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";

export type PlannedPackageArtifact = {
  relativePath: string;
  content: Buffer;
  kind: MarketingAssetArtifactKind;
  origin: MarketingAssetArtifactOrigin;
  mediaType: string;
  version?: number;
};

export type ArtifactWriteStatus = "created" | "reused";

function artifactIdFor(relativePath: string): string {
  return `art_${createHash("sha256").update(relativePath).digest("hex").slice(0, 16)}`;
}

export function describePlannedArtifact(
  planned: PlannedPackageArtifact,
  createdAt: string,
): MarketingAssetArtifact {
  return {
    artifactId: artifactIdFor(planned.relativePath),
    kind: planned.kind,
    relativePath: planned.relativePath,
    mediaType: planned.mediaType,
    byteSize: byteSize(planned.content),
    sha256: sha256Buffer(planned.content),
    createdAt,
    origin: planned.origin,
    version: planned.version ?? 1,
  };
}

export function assertPackageArtifactWritable(input: {
  packageRoot: string;
  planned: PlannedPackageArtifact;
}): void {
  const incomingSha256 = sha256Buffer(input.planned.content);
  const absolutePath = resolvePackageArtifactPath({
    packageRoot: input.packageRoot,
    relativePath: input.planned.relativePath,
  });
  if (!existsSync(absolutePath)) return;
  const existingSha256 = sha256Buffer(readFileSync(absolutePath));
  if (existingSha256 !== incomingSha256) {
    throw new MarketingAssetConflictError({
      relativePath: input.planned.relativePath,
      existingSha256,
      incomingSha256,
    });
  }
}

export function writePackageArtifact(input: {
  packageRoot: string;
  planned: PlannedPackageArtifact;
  createdAt: string;
}): { status: ArtifactWriteStatus; artifact: MarketingAssetArtifact } {
  const artifact = describePlannedArtifact(input.planned, input.createdAt);
  assertPackageArtifactWritable({ packageRoot: input.packageRoot, planned: input.planned });
  const absolutePath = resolvePackageArtifactPath({
    packageRoot: input.packageRoot,
    relativePath: input.planned.relativePath,
  });

  if (existsSync(absolutePath)) {
    const existing = readFileSync(absolutePath);
    return { status: "reused", artifact: { ...artifact, byteSize: existing.byteLength } };
  }

  atomicWriteFile(absolutePath, input.planned.content);
  return { status: "created", artifact };
}
