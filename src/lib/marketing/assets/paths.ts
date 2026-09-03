import { existsSync, mkdirSync } from "node:fs";
import { isAbsolute, join, posix, relative, resolve, sep } from "node:path";

import { MarketingAssetPathError } from "@/lib/marketing/assets/errors";

export const MARKETING_ASSET_GENERATED_DIRECTORIES = ["context", "copy", "cardnews", "reel"] as const;
export const MARKETING_ASSET_HUMAN_EDITED_DIRECTORY = "human-edited" as const;
export const MARKETING_ASSET_PUBLISHED_DIRECTORY = "published" as const;

export const MARKETING_ASSET_PACKAGE_DIRECTORIES = [
  "context",
  "copy",
  "cardnews",
  "reel",
  "reel/prompts",
  "reel/incoming",
  "reel/audio",
  "reel/audio/segments",
  "reel/final",
  MARKETING_ASSET_HUMAN_EDITED_DIRECTORY,
  MARKETING_ASSET_PUBLISHED_DIRECTORY,
] as const;

const CANDIDATE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const BUSINESS_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function rejectUnsafePathInput(value: string, label: string): void {
  if (!value || !value.trim()) {
    throw new MarketingAssetPathError(`${label} must be a non-empty string`);
  }
  if (value.includes("\0")) {
    throw new MarketingAssetPathError(`${label} must not contain a NUL byte`);
  }
  if (value.includes("\\") || /^[A-Za-z]:/.test(value)) {
    throw new MarketingAssetPathError(`${label} must not contain a Windows or drive path`);
  }
  if (value.includes("..")) {
    throw new MarketingAssetPathError(`${label} must not contain path traversal`);
  }
}

export function assertSafeCandidateId(candidateId: string): string {
  rejectUnsafePathInput(candidateId, "candidateId");
  if (isAbsolute(candidateId) || candidateId.startsWith("/") || candidateId.includes("/")) {
    throw new MarketingAssetPathError("candidateId must not contain an absolute path or directory separator");
  }
  if (!CANDIDATE_ID_PATTERN.test(candidateId)) {
    throw new MarketingAssetPathError(
      "candidateId must be a single path segment of letters, digits, underscore, or hyphen",
    );
  }
  return candidateId;
}

export function splitBusinessDateParts(businessDateKst: string): { year: string; month: string; day: string } {
  rejectUnsafePathInput(businessDateKst, "businessDateKst");
  const match = BUSINESS_DATE_PATTERN.exec(businessDateKst);
  if (!match) {
    throw new MarketingAssetPathError("businessDateKst must be YYYY-MM-DD");
  }
  const year = match[1];
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new MarketingAssetPathError("businessDateKst must be a valid calendar date");
  }
  return { year, month: match[2], day: match[3] };
}

export function assertSafeRelativeArtifactPath(relativePath: string): string {
  rejectUnsafePathInput(relativePath, "relativePath");
  if (isAbsolute(relativePath) || relativePath.startsWith("/")) {
    throw new MarketingAssetPathError("artifact relativePath must not be absolute");
  }
  if (relativePath.includes(":")) {
    throw new MarketingAssetPathError("artifact relativePath must not contain a drive prefix");
  }
  const posixPath = relativePath.replaceAll("\\", "/");
  const segments = posixPath.split("/").filter((segment, index) => !(index === 0 && segment === "."));
  if (segments.length === 0 || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new MarketingAssetPathError("artifact relativePath must be a safe package-relative posix path");
  }
  const normalized = posix.normalize(segments.join("/"));
  if (normalized.startsWith("..") || posix.isAbsolute(normalized) || normalized !== segments.join("/")) {
    throw new MarketingAssetPathError("artifact relativePath must stay a canonical package-relative path");
  }
  return normalized;
}

export function isPathInside(parent: string, child: string): boolean {
  const resolvedParent = resolve(parent);
  const resolvedChild = resolve(child);
  const rel = relative(resolvedParent, resolvedChild);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

export function assertPathInside(parent: string, child: string, label: string): string {
  const resolvedChild = resolve(child);
  if (!isPathInside(parent, resolvedChild)) {
    throw new MarketingAssetPathError(`${label} must remain under the configured marketing asset root`);
  }
  return resolvedChild;
}

export function resolvePackageDirectory(input: {
  assetRoot: string;
  businessDateKst: string;
  candidateId: string;
}): string {
  const candidateId = assertSafeCandidateId(input.candidateId);
  const { year, month, day } = splitBusinessDateParts(input.businessDateKst);
  const packageRoot = resolve(input.assetRoot, year, month, day, candidateId);
  return assertPathInside(input.assetRoot, packageRoot, "package root");
}

export function resolvePackageRelativePath(input: {
  assetRoot: string;
  businessDateKst: string;
  candidateId: string;
}): string {
  const candidateId = assertSafeCandidateId(input.candidateId);
  const { year, month, day } = splitBusinessDateParts(input.businessDateKst);
  return `${year}/${month}/${day}/${candidateId}`;
}

export function resolvePackageArtifactPath(input: { packageRoot: string; relativePath: string }): string {
  const relativePath = assertSafeRelativeArtifactPath(input.relativePath);
  const absolutePath = resolve(input.packageRoot, ...relativePath.split("/"));
  return assertPathInside(input.packageRoot, absolutePath, "artifact path");
}

export function ensurePackageLayout(packageRoot: string): void {
  mkdirSync(packageRoot, { recursive: true });
  for (const directory of MARKETING_ASSET_PACKAGE_DIRECTORIES) {
    mkdirSync(join(packageRoot, ...directory.split("/")), { recursive: true });
  }
}

export function packageLayoutExists(packageRoot: string): boolean {
  return existsSync(packageRoot);
}
