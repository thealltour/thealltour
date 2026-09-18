/**
 * Resolve package-relative storedPath to an absolute path under packageRoot.
 * Rejects traversal / absolute escapes (manifest tampering).
 */

import { existsSync, readFileSync } from "node:fs";

import { MarketingAssetPathError } from "@/lib/marketing/assets/errors";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { assertLocalVisualPath } from "@/lib/marketing/assets/cardnews/visuals";

export function resolveSafeSharedVisualAbsolutePath(input: {
  packageRoot: string;
  storedPath: string;
}): string {
  const stored = input.storedPath.trim();
  if (!stored) {
    throw new MarketingAssetPathError("storedPath is empty");
  }
  // Package-relative only — never trust absolute or URL-like paths from manifest.
  if (
    stored.startsWith("/") ||
    stored.includes("\0") ||
    stored.includes("..") ||
    stored.includes("\\") ||
    /^[A-Za-z]:/.test(stored) ||
    /^(https?:|file:|data:)/i.test(stored)
  ) {
    throw new MarketingAssetPathError("storedPath must be a safe package-relative path");
  }

  const absolute = resolvePackageArtifactPath({
    packageRoot: input.packageRoot,
    relativePath: stored,
  });

  // Double-check against cardnews visual root rules.
  return assertLocalVisualPath({
    rawPath: absolute,
    allowedRoots: [input.packageRoot],
  });
}

export function readSafeSharedVisualBytes(input: {
  packageRoot: string;
  storedPath: string;
}): { absolutePath: string; bytes: Buffer } {
  const absolutePath = resolveSafeSharedVisualAbsolutePath(input);
  if (!existsSync(absolutePath)) {
    throw new MarketingAssetPathError(`shared visual file missing: ${input.storedPath}`);
  }
  return { absolutePath, bytes: readFileSync(absolutePath) };
}
