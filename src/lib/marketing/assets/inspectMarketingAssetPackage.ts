import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

import {
  resolveMarketingAssetRoot,
  type MarketingAssetEnv,
} from "@/lib/marketing/assets/config";
import type {
  MarketingAssetArtifact,
  MarketingAssetManifest,
  MarketingAssetStage,
} from "@/lib/marketing/assets/contracts";
import { MarketingAssetConfigError, MarketingAssetPathError } from "@/lib/marketing/assets/errors";
import { parseMarketingAssetManifest } from "@/lib/marketing/assets/parse";
import {
  assertSafeCandidateId,
  assertSafeRelativeArtifactPath,
  packageLayoutExists,
  resolvePackageArtifactPath,
  resolvePackageDirectory,
  resolvePackageRelativePath,
  splitBusinessDateParts,
} from "@/lib/marketing/assets/paths";

export type MarketingAssetPackageInspectStatus = "missing" | "present";

export type MarketingAssetPackageInspection = {
  status: MarketingAssetPackageInspectStatus;
  candidateId: string;
  businessDateKst: string;
  assetRootConfigured: boolean;
  packageRoot: string | null;
  relativePackagePath: string | null;
  packageId: string | null;
  stage: MarketingAssetStage | null;
  artifacts: MarketingAssetArtifact[];
  updatedAt: string | null;
  createdAt: string | null;
  integrityDigest: string | null;
};

export type MarketingAssetPackageFileRead = {
  candidateId: string;
  businessDateKst: string;
  relativePath: string;
  absolutePath: string;
  fileName: string;
  bytes: Buffer;
  mediaType: string;
  byteSize: number;
};

function mediaTypeForRelativePath(relativePath: string): string {
  if (relativePath.endsWith(".json")) return "application/json";
  if (relativePath.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (relativePath.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (relativePath.endsWith(".png")) return "image/png";
  if (relativePath.endsWith(".jpg") || relativePath.endsWith(".jpeg")) return "image/jpeg";
  if (relativePath.endsWith(".webp")) return "image/webp";
  if (relativePath.endsWith(".wav")) return "audio/wav";
  if (relativePath.endsWith(".srt")) return "application/x-subrip";
  if (relativePath.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

function tryResolveAssetRoot(env?: MarketingAssetEnv): string | null {
  try {
    return resolveMarketingAssetRoot({ env });
  } catch (error) {
    if (error instanceof MarketingAssetConfigError) return null;
    throw error;
  }
}

function readManifestIfPresent(packageRoot: string): MarketingAssetManifest | null {
  const manifestPath = join(packageRoot, "manifest.json");
  if (!existsSync(manifestPath)) return null;
  try {
    return parseMarketingAssetManifest(JSON.parse(readFileSync(manifestPath, "utf8")) as unknown);
  } catch {
    return null;
  }
}

function missingInspection(input: {
  candidateId: string;
  businessDateKst: string;
  assetRootConfigured: boolean;
  packageRoot?: string | null;
  relativePackagePath?: string | null;
}): MarketingAssetPackageInspection {
  return {
    status: "missing",
    candidateId: input.candidateId,
    businessDateKst: input.businessDateKst,
    assetRootConfigured: input.assetRootConfigured,
    packageRoot: input.packageRoot ?? null,
    relativePackagePath: input.relativePackagePath ?? null,
    packageId: null,
    stage: null,
    artifacts: [],
    updatedAt: null,
    createdAt: null,
    integrityDigest: null,
  };
}

/**
 * Read-only package inspection under MARKETING_ASSET_ROOT.
 * Missing root / missing package → status "missing" (not an error).
 * Path/candidate validation errors still throw.
 */
export function inspectMarketingAssetPackage(input: {
  candidateId: string;
  businessDateKst: string;
  env?: MarketingAssetEnv;
}): MarketingAssetPackageInspection {
  const candidateId = assertSafeCandidateId(input.candidateId);
  splitBusinessDateParts(input.businessDateKst);
  const assetRoot = tryResolveAssetRoot(input.env);
  if (!assetRoot) {
    return missingInspection({
      candidateId,
      businessDateKst: input.businessDateKst,
      assetRootConfigured: false,
    });
  }

  const relativePackagePath = resolvePackageRelativePath({
    assetRoot,
    businessDateKst: input.businessDateKst,
    candidateId,
  });
  const packageRoot = resolvePackageDirectory({
    assetRoot,
    businessDateKst: input.businessDateKst,
    candidateId,
  });

  if (!packageLayoutExists(packageRoot)) {
    return missingInspection({
      candidateId,
      businessDateKst: input.businessDateKst,
      assetRootConfigured: true,
      packageRoot,
      relativePackagePath,
    });
  }

  const manifest = readManifestIfPresent(packageRoot);
  if (!manifest) {
    return missingInspection({
      candidateId,
      businessDateKst: input.businessDateKst,
      assetRootConfigured: true,
      packageRoot,
      relativePackagePath,
    });
  }

  return {
    status: "present",
    candidateId,
    businessDateKst: input.businessDateKst,
    assetRootConfigured: true,
    packageRoot,
    relativePackagePath,
    packageId: manifest.packageId,
    stage: manifest.stage,
    artifacts: manifest.artifacts,
    updatedAt: manifest.updatedAt,
    createdAt: manifest.createdAt,
    integrityDigest: manifest.integrity.digest,
  };
}

/**
 * Path-safe file read inside a candidate package.
 * Allows manifest.json and any package-relative artifact path.
 */
export function readMarketingAssetPackageFile(input: {
  candidateId: string;
  businessDateKst: string;
  relativePath: string;
  env?: MarketingAssetEnv;
}): MarketingAssetPackageFileRead {
  const candidateId = assertSafeCandidateId(input.candidateId);
  splitBusinessDateParts(input.businessDateKst);
  const assetRoot = resolveMarketingAssetRoot({ env: input.env });
  const packageRoot = resolvePackageDirectory({
    assetRoot,
    businessDateKst: input.businessDateKst,
    candidateId,
  });

  if (!packageLayoutExists(packageRoot)) {
    throw new MarketingAssetPathError(`package not found for candidate ${candidateId}`);
  }

  const relativePath =
    input.relativePath.trim() === "manifest.json"
      ? "manifest.json"
      : assertSafeRelativeArtifactPath(input.relativePath);

  const absolutePath = resolvePackageArtifactPath({ packageRoot, relativePath });
  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    throw new MarketingAssetPathError(`artifact not found: ${relativePath}`);
  }

  const bytes = readFileSync(absolutePath);
  const manifest = readManifestIfPresent(packageRoot);
  const fromManifest = manifest?.artifacts.find((item) => item.relativePath === relativePath);
  const mediaType = fromManifest?.mediaType ?? mediaTypeForRelativePath(relativePath);

  return {
    candidateId,
    businessDateKst: input.businessDateKst,
    relativePath,
    absolutePath,
    fileName: basename(relativePath),
    bytes,
    mediaType,
    byteSize: bytes.byteLength,
  };
}
