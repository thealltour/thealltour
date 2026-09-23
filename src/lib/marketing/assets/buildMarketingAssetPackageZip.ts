import "server-only";

import JSZip from "jszip";

import type { MarketingAssetEnv } from "@/lib/marketing/assets/config";
import { MarketingAssetPathError } from "@/lib/marketing/assets/errors";
import {
  inspectMarketingAssetPackage,
  readMarketingAssetPackageFile,
} from "@/lib/marketing/assets/inspectMarketingAssetPackage";

export type MarketingAssetPackageZipBuild = {
  candidateId: string;
  businessDateKst: string;
  packageId: string | null;
  relativePackagePath: string | null;
  zipFileName: string;
  bytes: Buffer;
  entryCount: number;
  byteSize: number;
};

function safeZipFileName(
  candidateId: string,
  relativePackagePath: string | null,
  suffix?: string | null,
): string {
  const fromPath = relativePackagePath?.split("/").filter(Boolean).pop() ?? null;
  const base = (fromPath || candidateId).replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const stem = base || "marketing-package";
  const tag = suffix?.replace(/[^\w.\-]+/g, "_").slice(0, 40);
  return tag ? `${stem}-${tag}.zip` : `${stem}.zip`;
}

/**
 * Build a ZIP of package artifacts for admin download.
 * Path-safe: reuses inspect + readMarketingAssetPackageFile guards.
 *
 * When `relativePathPrefix` is set (e.g. `"cardnews/"`), only matching
 * artifacts are included and `manifest.json` is omitted.
 */
export async function buildMarketingAssetPackageZip(input: {
  candidateId: string;
  businessDateKst: string;
  env?: MarketingAssetEnv;
  /** Include only paths under this prefix (posix, trailing slash optional). */
  relativePathPrefix?: string | null;
  zipFileNameSuffix?: string | null;
}): Promise<MarketingAssetPackageZipBuild> {
  const inspection = inspectMarketingAssetPackage({
    candidateId: input.candidateId,
    businessDateKst: input.businessDateKst,
    env: input.env,
  });

  if (!inspection.assetRootConfigured) {
    throw new MarketingAssetPathError("MARKETING_ASSET_ROOT is not configured");
  }
  if (inspection.status !== "present") {
    throw new MarketingAssetPathError(`package not found for candidate ${input.candidateId}`);
  }

  const prefixRaw = input.relativePathPrefix?.trim() ?? "";
  const prefix = prefixRaw
    ? prefixRaw.endsWith("/")
      ? prefixRaw
      : `${prefixRaw}/`
    : null;

  const relativePaths = prefix
    ? inspection.artifacts
        .map((item) => item.relativePath)
        .filter((path) => path === prefix.slice(0, -1) || path.startsWith(prefix))
    : [...inspection.artifacts.map((item) => item.relativePath), "manifest.json"];
  const uniquePaths = [...new Set(relativePaths)];

  const zip = new JSZip();
  let entryCount = 0;

  for (const relativePath of uniquePaths) {
    try {
      const file = readMarketingAssetPackageFile({
        candidateId: input.candidateId,
        businessDateKst: input.businessDateKst,
        relativePath,
        env: input.env,
      });
      zip.file(file.relativePath, file.bytes);
      entryCount += 1;
    } catch (error) {
      if (error instanceof MarketingAssetPathError && /not found/i.test(error.message)) {
        // Manifest may list a path that was removed; skip rather than fail the whole zip.
        continue;
      }
      throw error;
    }
  }

  if (entryCount === 0) {
    throw new MarketingAssetPathError(
      prefix
        ? `no readable artifacts under ${prefix} for candidate ${input.candidateId}`
        : `no readable artifacts for candidate ${input.candidateId}`,
    );
  }

  const bytes = Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    }),
  );

  return {
    candidateId: inspection.candidateId,
    businessDateKst: inspection.businessDateKst,
    packageId: inspection.packageId,
    relativePackagePath: inspection.relativePackagePath,
    zipFileName: safeZipFileName(
      inspection.candidateId,
      inspection.relativePackagePath,
      input.zipFileNameSuffix,
    ),
    bytes,
    entryCount,
    byteSize: bytes.byteLength,
  };
}
