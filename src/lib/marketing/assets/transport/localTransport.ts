import "server-only";

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";

import { resolveMarketingAssetRoot } from "@/lib/marketing/assets/config";
import { parseMarketingAssetManifest } from "@/lib/marketing/assets/parse";
import {
  assertPathInside,
  assertSafeRelativeArtifactPath,
  resolvePackageArtifactPath,
  resolvePackageDirectory,
} from "@/lib/marketing/assets/paths";
import type { MarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/repository";
import { persistShortformFinalArtifact } from "@/lib/marketing/assets/shortform/production/persistFinal";
import {
  MARKETING_ASSET_TRANSFER_LIMITS,
  resolveCandidatePackageArtifactRelativePath,
  type CandidatePackageArtifactKind,
  type MarketingAssetTransport,
  type MarketingAssetTransportReadiness,
  type MaterializeManagedSourceResult,
  type PersistShortformFinalResult,
  type ReadCandidatePackageArtifactResult,
  SHORTFORM_FINAL_TRANSFER_RELATIVE_PATH,
} from "@/lib/marketing/assets/transport/contracts";
import { MarketingAssetTransportError } from "@/lib/marketing/assets/transport/errors";
import { sha256Buffer } from "@/lib/marketing/assets/transport/server/auth";

function readPackageManifestSha(
  packageRoot: string,
  relativePath: string,
): string | null {
  const manifestPath = join(packageRoot, "manifest.json");
  if (!existsSync(manifestPath)) return null;
  try {
    const manifest = parseMarketingAssetManifest(
      JSON.parse(readFileSync(manifestPath, "utf8")) as unknown,
    );
    const hit = manifest.artifacts.find((a) => a.relativePath === relativePath);
    return hit?.sha256 ?? null;
  } catch {
    return null;
  }
}

export function createLocalMarketingAssetTransport(input: {
  catalog: MarketingMediaSourceCatalogRepository;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): MarketingAssetTransport {
  const env = input.env ?? process.env;

  return {
    mode: "local",

    probeReadiness(): MarketingAssetTransportReadiness {
      const hasRoot = Boolean(env.MARKETING_ASSET_ROOT?.trim());
      return {
        ready: hasRoot,
        reason: hasRoot ? "ready" : "not_ready:marketingAssetRoot",
        mode: "local",
        checks: { marketingAssetRoot: hasRoot },
      };
    },

    async materializeManagedSource({ sourceId, destinationAbsolutePath }) {
      const source = await input.catalog.getById(sourceId);
      if (!source) {
        throw new MarketingAssetTransportError("source not found", "SOURCE_NOT_FOUND", 404);
      }
      if (source.status !== "active") {
        throw new MarketingAssetTransportError("source not active", "SOURCE_NOT_ACTIVE", 409);
      }
      if (!source.managedRelativePath) {
        throw new MarketingAssetTransportError(
          "source is not locally managed",
          "SOURCE_NOT_LOCALLY_MANAGED",
          422,
        );
      }
      const relative = assertSafeRelativeArtifactPath(source.managedRelativePath);
      const assetRoot = resolveMarketingAssetRoot({ env });
      const absolute = assertPathInside(assetRoot, join(assetRoot, relative), "managedSource");
      if (!existsSync(absolute)) {
        throw new MarketingAssetTransportError("managed source file missing", "INTERNAL_SOURCE_MISSING", 404);
      }
      const st = statSync(absolute);
      if (st.size > MARKETING_ASSET_TRANSFER_LIMITS.managedSourceMaxBytes) {
        throw new MarketingAssetTransportError("managed source too large", "SOURCE_TOO_LARGE", 413);
      }
      const bytes = readFileSync(absolute);
      const digest = sha256Buffer(bytes);
      if (source.sha256 && source.sha256 !== digest) {
        throw new MarketingAssetTransportError("source integrity mismatch", "SOURCE_INTEGRITY_MISMATCH", 409);
      }
      mkdirSync(dirname(destinationAbsolutePath), { recursive: true });
      copyFileSync(absolute, destinationAbsolutePath);
      return {
        absolutePath: destinationAbsolutePath,
        sourceId,
        sha256: digest,
        byteSize: bytes.byteLength,
        mediaType: source.mimeType,
      } satisfies MaterializeManagedSourceResult;
    },

    async readCandidatePackageArtifact({ candidateId, businessDateKst, artifactKind }) {
      const relativePath = resolveCandidatePackageArtifactRelativePath(artifactKind);
      const assetRoot = resolveMarketingAssetRoot({ env });
      const packageRoot = resolvePackageDirectory({
        assetRoot,
        businessDateKst,
        candidateId,
      });
      const absolute = resolvePackageArtifactPath({ packageRoot, relativePath });
      if (!existsSync(absolute)) {
        throw new MarketingAssetTransportError(
          "candidate package artifact missing",
          "CANDIDATE_ARTIFACT_MISSING",
          404,
        );
      }
      const st = statSync(absolute);
      if (st.size > MARKETING_ASSET_TRANSFER_LIMITS.candidateArtifactMaxBytes) {
        throw new MarketingAssetTransportError(
          "candidate artifact too large",
          "CANDIDATE_ARTIFACT_TOO_LARGE",
          413,
        );
      }
      const bytes = readFileSync(absolute);
      const digest = sha256Buffer(bytes);
      const expected = readPackageManifestSha(packageRoot, relativePath);
      if (expected && expected !== digest) {
        throw new MarketingAssetTransportError(
          "candidate artifact integrity mismatch",
          "CANDIDATE_ARTIFACT_INTEGRITY_MISMATCH",
          409,
        );
      }
      return {
        artifactKind: artifactKind as CandidatePackageArtifactKind,
        relativePath,
        bytes,
        sha256: digest,
        byteSize: bytes.byteLength,
        mediaType: "application/json",
      } satisfies ReadCandidatePackageArtifactResult;
    },

    async persistShortformFinal({ candidateId, businessDateKst, workspaceFinalAbsolutePath }) {
      const assetRoot = resolveMarketingAssetRoot({ env });
      const packageRoot = resolvePackageDirectory({
        assetRoot,
        businessDateKst,
        candidateId,
      });
      const persisted = persistShortformFinalArtifact({
        packageRoot,
        workspaceFinalAbsolutePath,
      });
      return {
        relativePath: SHORTFORM_FINAL_TRANSFER_RELATIVE_PATH,
        sha256: persisted.sha256,
        byteSize: persisted.byteSize,
        mediaType: "video/mp4",
      } satisfies PersistShortformFinalResult;
    },
  };
}

export function destinationPathForManagedSource(input: {
  workspaceSourceDir: string;
  sceneId: string;
  preferredExt?: string;
}): string {
  const ext = input.preferredExt && input.preferredExt.startsWith(".")
    ? input.preferredExt
    : extname(input.preferredExt ?? "") || ".bin";
  return join(input.workspaceSourceDir, `${input.sceneId}${ext}`);
}
