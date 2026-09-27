import { existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";

import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { overwritePackageArtifact, writePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import { CHANNEL_SOURCES_JSON_MEDIA_TYPE } from "@/lib/marketing/publishable/channelSources/paths";
import {
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import { persistPublishableContentBundle } from "@/lib/marketing/publishable/persist";

export function readPackageJson<T = unknown>(packageRoot: string, relativePath: string): T | null {
  const absolute = resolvePackageArtifactPath({ packageRoot, relativePath });
  if (!existsSync(absolute)) return null;
  try {
    return JSON.parse(readFileSync(absolute, "utf8")) as T;
  } catch {
    return null;
  }
}

export function packageFileExists(packageRoot: string, relativePath: string): boolean {
  return existsSync(resolvePackageArtifactPath({ packageRoot, relativePath }));
}

export function listPackageJsonFiles(packageRoot: string, relativeDirectory: string): string[] {
  const absolute = resolvePackageArtifactPath({ packageRoot, relativePath: relativeDirectory });
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => `${relativeDirectory}/${name}`);
}

/** Same bytes/kind/origin as the specialist persist helpers, so sidecar fingerprints round-trip. */
export function writeMutablePackageJson(
  packageRoot: string,
  relativePath: string,
  value: unknown,
  createdAt: string,
): void {
  overwritePackageArtifact({
    packageRoot,
    planned: {
      relativePath,
      content: stableJsonBytes(value),
      kind: "context",
      origin: "pipeline_export",
      mediaType: CHANNEL_SOURCES_JSON_MEDIA_TYPE,
    },
    createdAt,
  });
}

/** Create-only write; throws MarketingAssetConflictError when different bytes already exist. */
export function writeImmutablePackageJson(
  packageRoot: string,
  relativePath: string,
  value: unknown,
  createdAt: string,
): "created" | "reused" {
  return writePackageArtifact({
    packageRoot,
    planned: {
      relativePath,
      content: stableJsonBytes(value),
      kind: "context",
      origin: "pipeline_export",
      mediaType: CHANNEL_SOURCES_JSON_MEDIA_TYPE,
    },
    createdAt,
  }).status;
}

export function removePackageFile(packageRoot: string, relativePath: string): void {
  const absolute = resolvePackageArtifactPath({ packageRoot, relativePath });
  if (existsSync(absolute)) unlinkSync(absolute);
}

export function readPublishableBundle(packageRoot: string): PublishableContentBundle | null {
  const raw = readPackageJson<PublishableContentBundle>(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH);
  return raw?.contract === PUBLISHABLE_CONTENT_BUNDLE_CONTRACT ? raw : null;
}

export function writePublishableBundle(
  packageRoot: string,
  bundle: PublishableContentBundle,
  createdAt: string,
): void {
  persistPublishableContentBundle({ packageRoot, bundle, createdAt });
}
