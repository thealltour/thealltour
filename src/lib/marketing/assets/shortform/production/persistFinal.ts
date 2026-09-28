import "server-only";

import { existsSync, readFileSync } from "node:fs";

import { sha256Buffer } from "@/lib/marketing/assets/hashing";
import { upsertPackageManifestArtifact } from "@/lib/marketing/assets/manifestUpsert";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { overwritePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import { ShortformProductionError } from "@/lib/marketing/assets/shortform/production/errors";
import {
  SHORTFORM_FINAL_ARTIFACT_KIND,
  SHORTFORM_FINAL_MEDIA_TYPE,
  SHORTFORM_FINAL_ORIGIN,
  SHORTFORM_FINAL_RELATIVE_PATH,
} from "@/lib/marketing/assets/shortform/production/paths";

/**
 * Persist workspace final into Candidate Package (durable) before READY.
 * Never marks READY itself — returns package-relative path for worker markReady.
 * Replaces an earlier final: re-renders (edited narration, new picks) share one path, and the
 * approval gate decides which READY job is current via its input fingerprints.
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
  const written = overwritePackageArtifact({
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

  // Package may be partial in tests; durable file + sha256 are still required.
  const manifestUpdated = upsertPackageManifestArtifact({
    packageRoot: input.packageRoot,
    artifact: written.artifact,
    createdAt,
  });

  return {
    relativePath: SHORTFORM_FINAL_RELATIVE_PATH,
    sha256,
    byteSize: durable.byteLength,
    manifestUpdated,
  };
}
