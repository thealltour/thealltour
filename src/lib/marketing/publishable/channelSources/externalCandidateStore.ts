import { createHash } from "node:crypto";

import {
  EXTERNAL_EDITORIAL_CANDIDATE_CONTRACT,
  type ExternalEditorialCandidate,
} from "@/lib/marketing/publishable/channelSources/contracts";
import {
  listPackageJsonFiles,
  packageFileExists,
  readPackageJson,
  writeImmutablePackageJson,
} from "@/lib/marketing/publishable/channelSources/packageIo";
import {
  EXTERNAL_EDITORIAL_CANDIDATES_DIRECTORY,
  externalEditorialCandidateRelativePath,
} from "@/lib/marketing/publishable/channelSources/paths";

export class ExternalEditorialCandidateExistsError extends Error {
  readonly importId: string;
  constructor(importId: string) {
    super(`external editorial candidate already exists: ${importId}`);
    this.name = "ExternalEditorialCandidateExistsError";
    this.importId = importId;
  }
}

export function buildExternalImportId(raw: string, now: Date): string {
  const digest = createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 10);
  return `xe_${String(now.getTime()).padStart(13, "0")}_${digest}`;
}

/** Never overwrites: an existing importId is a hard error even with identical bytes. */
export function persistExternalEditorialCandidate(input: {
  packageRoot: string;
  candidate: ExternalEditorialCandidate;
}): string {
  const relativePath = externalEditorialCandidateRelativePath(input.candidate.importId);
  if (packageFileExists(input.packageRoot, relativePath)) {
    throw new ExternalEditorialCandidateExistsError(input.candidate.importId);
  }
  writeImmutablePackageJson(input.packageRoot, relativePath, input.candidate, input.candidate.importedAt);
  return relativePath;
}

function isCandidate(value: unknown): value is ExternalEditorialCandidate {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as ExternalEditorialCandidate).contract === EXTERNAL_EDITORIAL_CANDIDATE_CONTRACT,
  );
}

export function readExternalEditorialCandidateByRef(
  packageRoot: string,
  candidateRef: string,
): ExternalEditorialCandidate | null {
  if (!candidateRef.startsWith(`${EXTERNAL_EDITORIAL_CANDIDATES_DIRECTORY}/`)) return null;
  const value = readPackageJson(packageRoot, candidateRef);
  return isCandidate(value) ? value : null;
}

export function readExternalEditorialCandidate(
  packageRoot: string,
  importId: string,
): ExternalEditorialCandidate | null {
  let relativePath: string;
  try {
    relativePath = externalEditorialCandidateRelativePath(importId);
  } catch {
    return null;
  }
  return readExternalEditorialCandidateByRef(packageRoot, relativePath);
}

export function listExternalEditorialCandidates(packageRoot: string): ExternalEditorialCandidate[] {
  return listPackageJsonFiles(packageRoot, EXTERNAL_EDITORIAL_CANDIDATES_DIRECTORY)
    .map((ref) => readExternalEditorialCandidateByRef(packageRoot, ref))
    .filter((c): c is ExternalEditorialCandidate => c !== null)
    .sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}
